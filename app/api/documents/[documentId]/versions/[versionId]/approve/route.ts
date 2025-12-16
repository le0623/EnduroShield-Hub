import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { processAndEmbedVersion } from '@/lib/rag/embeddings';
import { loadFileText, loadPDFText, loadDOCXText } from '@/lib/utils/fileLoader';

// DOCX and DOC MIME types
const WORD_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/docx',
  'application/msword', // .doc
];

// POST /api/documents/[documentId]/versions/[versionId]/approve - Approve a document version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string; versionId: string }> }
) {
  try {
    const { documentId, versionId } = await params;
    const { user, tenant } = await requireTenant(request);

    // Get user's role in this tenant
    const userMembership = await prisma.tenantMember.findFirst({
      where: {
        userId: user.id,
        tenantId: tenant.id,
      },
    });

    if (!userMembership || userMembership.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only administrators can approve document versions' },
        { status: 403 }
      );
    }

    // Check if document exists and belongs to tenant
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        tenantId: tenant.id,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get the version to approve
    const version = await prisma.documentVersion.findFirst({
      where: {
        id: versionId,
        documentId: documentId,
      },
    });

    if (!version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    // Check if version is already processed
    if (version.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Version has already been processed' },
        { status: 400 }
      );
    }

    // Process and embed version for RAG FIRST (before approval)
    try {
      // Load document text based on file type
      let text: string;
      
      if (version.mimeType === 'application/pdf') {
        console.log(`📄 Processing PDF document version: ${document.name} v${version.versionNumber}`);
        text = await loadPDFText(version.fileUrl);
      } else if (WORD_MIME_TYPES.includes(version.mimeType)) {
        console.log(`📝 Processing Word document version: ${document.name} v${version.versionNumber} (${version.mimeType})`);
        text = await loadDOCXText(version.fileUrl);
      } else {
        console.log(`📃 Processing text document version: ${document.name} v${version.versionNumber} (${version.mimeType})`);
        text = await loadFileText(version.fileUrl, version.mimeType);
      }

      if (!text || text.trim() === '') {
        throw new Error('No text content could be extracted from the document');
      }

      console.log(`📊 Extracted ${text.length} characters from version`);

      // Prepend document name and description for better semantic search
      const metadataPrefix = `Document Title: ${document.name}\n${document.description ? `Description: ${document.description}\n\n` : '\n'}`;
      const textWithMetadata = metadataPrefix + text;

      console.log(`📝 Added metadata prefix (${metadataPrefix.length} chars) to document content`);

      // Process and embed the version
      await processAndEmbedVersion(versionId, textWithMetadata);
      console.log(`✅ Version ${versionId} processed and embedded successfully`);
    } catch (error) {
      console.error('Error processing version for RAG:', error);
      return NextResponse.json(
        { 
          error: 'Failed to process and embed version. Version was not approved.',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Only approve version if processing and embedding succeeded
    const approvedVersion = await prisma.documentVersion.update({
      where: { id: versionId },
      data: {
        status: 'APPROVED',
        approvedBy: user.id,
        approvedAt: new Date(),
      },
      include: {
        uploadedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        approvedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // If no active version exists, set this as the active version
    if (!document.activeVersionId) {
      await prisma.document.update({
        where: { id: documentId },
        data: { activeVersionId: versionId },
      });
    }

    return NextResponse.json({
      message: 'Version approved successfully',
      version: {
        id: approvedVersion.id,
        versionNumber: approvedVersion.versionNumber,
        status: approvedVersion.status,
        approvedBy: approvedVersion.approvedByUser,
        approvedAt: approvedVersion.approvedAt,
      },
    });
  } catch (error) {
    console.error('Error approving version:', error);
    return NextResponse.json(
      { error: 'Failed to approve version' },
      { status: 500 }
    );
  }
}


