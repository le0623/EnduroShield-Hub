import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { processAndEmbedDocument } from '@/lib/rag/embeddings';
import { loadFileText, loadPDFText, loadDOCXText } from '@/lib/utils/fileLoader';

// DOCX and DOC MIME types
const WORD_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/docx',
  'application/msword', // .doc
];

// POST /api/documents/[documentId]/approve - Approve a document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
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
        { error: 'Only administrators can approve documents' },
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

    // Check if document is already processed
    if (document.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Document has already been processed' },
        { status: 400 }
      );
    }

    // Process and embed document for RAG FIRST (before approval)
    try {
      // Load document text based on file type
      let text: string;
      
      if (document.mimeType === 'application/pdf') {
        console.log(`📄 Processing PDF document: ${document.name}`);
        text = await loadPDFText(document.fileUrl);
      } else if (WORD_MIME_TYPES.includes(document.mimeType)) {
        console.log(`📝 Processing Word document: ${document.name} (${document.mimeType})`);
        text = await loadDOCXText(document.fileUrl);
      } else {
        console.log(`📃 Processing text document: ${document.name} (${document.mimeType})`);
        text = await loadFileText(document.fileUrl, document.mimeType);
      }

      if (!text || text.trim() === '') {
        throw new Error('No text content could be extracted from the document');
      }

      console.log(`📊 Extracted ${text.length} characters from document`);

      // Prepend document name and description for better semantic search
      const metadataPrefix = `Document Title: ${document.name}\n${document.description ? `Description: ${document.description}\n\n` : '\n'}`;
      const textWithMetadata = metadataPrefix + text;

      console.log(`📝 Added metadata prefix (${metadataPrefix.length} chars) to document content`);

      // Process and embed the document
      await processAndEmbedDocument(documentId, textWithMetadata);
      console.log(`✅ Document ${documentId} processed and embedded successfully`);
    } catch (error) {
      console.error('Error processing document for RAG:', error);
      // If embedding fails, don't approve the document
      return NextResponse.json(
        { 
          error: 'Failed to process and embed document. Document was not approved.',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    // Only approve document if processing and embedding succeeded
    const approvedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'APPROVED',
        approvedBy: user.id,
        approvedAt: new Date(),
      },
      include: {
        submittedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImageUrl: true,
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

    return NextResponse.json({
      message: 'Document approved successfully',
      document: {
        id: approvedDocument.id,
        name: approvedDocument.name,
        status: approvedDocument.status,
        approvedBy: approvedDocument.approvedByUser,
        approvedAt: approvedDocument.approvedAt,
      },
    });
  } catch (error) {
    console.error('Error approving document:', error);
    return NextResponse.json(
      { error: 'Failed to approve document' },
      { status: 500 }
    );
  }
}
