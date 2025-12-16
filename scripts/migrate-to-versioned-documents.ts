/**
 * Migration script to convert existing documents to the new versioned schema
 * 
 * This script:
 * 1. Creates DocumentVersion records for each existing Document
 * 2. Links DocumentChunks to the new DocumentVersion
 * 3. Updates Document to point to active version
 * 
 * Run with: npx ts-node scripts/migrate-to-versioned-documents.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateDocumentsToVersioned() {
  console.log('Starting migration to versioned documents...');

  try {
    // Get all existing documents with their chunks
    // Note: This runs on the OLD schema before migration
    const documents = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      original_name: string;
      description: string | null;
      file_url: string;
      file_key: string;
      file_size: number;
      mime_type: string;
      version: number;
      status: string;
      submitted_by: string;
      approved_by: string | null;
      rejected_by: string | null;
      rejection_reason: string | null;
      tenant_id: string;
      created_at: Date;
      approved_at: Date | null;
      rejected_at: Date | null;
    }>>`
      SELECT id, name, original_name, description, file_url, file_key, file_size, 
             mime_type, version, status, submitted_by, approved_by, rejected_by,
             rejection_reason, tenant_id, created_at, approved_at, rejected_at
      FROM documents
    `;

    console.log(`Found ${documents.length} documents to migrate`);

    for (const doc of documents) {
      console.log(`\nMigrating document: ${doc.name} (${doc.id})`);

      // Create DocumentVersion record
      const versionId = `ver_${doc.id.slice(0, 20)}`;
      
      await prisma.$executeRaw`
        INSERT INTO document_versions (
          id, document_id, version_number, original_name, file_url, file_key,
          file_size, mime_type, status, uploaded_by, approved_by, rejected_by,
          rejection_reason, created_at, approved_at, rejected_at
        ) VALUES (
          ${versionId}, ${doc.id}, ${doc.version}, ${doc.original_name}, ${doc.file_url},
          ${doc.file_key}, ${doc.file_size}, ${doc.mime_type}, ${doc.status}::"DocumentStatus",
          ${doc.submitted_by}, ${doc.approved_by}, ${doc.rejected_by},
          ${doc.rejection_reason}, ${doc.created_at}, ${doc.approved_at}, ${doc.rejected_at}
        )
      `;

      // Update document to set active version (only if APPROVED)
      if (doc.status === 'APPROVED') {
        await prisma.$executeRaw`
          UPDATE documents 
          SET active_version_id = ${versionId}, current_version = ${doc.version}
          WHERE id = ${doc.id}
        `;
      }

      // Update document chunks to point to version instead of document
      await prisma.$executeRaw`
        UPDATE document_chunks 
        SET version_id = ${versionId}
        WHERE document_id = ${doc.id}
      `;

      console.log(`  ✅ Created version ${versionId} for document`);
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateDocumentsToVersioned();

