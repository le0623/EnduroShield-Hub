import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadToS3, validateFileType, getFileSizeLimit } from '@/lib/s3';
import { processAndEmbedDocument } from '@/lib/rag/embeddings';
import { loadFileText, loadPDFText, loadDOCXText } from '@/lib/utils/fileLoader';

// DOCX and DOC MIME types for auto-approval processing
const WORD_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/docx',
  'application/msword', // .doc
];

export async function POST(request: NextRequest) {
  try {
    const { user, tenant } = await requireTenant(request);

    // Get user's role in this tenant
    const userMembership = await prisma.tenantMember.findFirst({
      where: {
        userId: user.id,
        tenantId: tenant.id,
      },
    });

    // Check if user has permission to upload documents (Only Admin can upload)
    if (!userMembership || userMembership.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Insufficient permissions to upload documents. Only admins can upload.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const accessTagIds = formData.get('accessTagIds') as string; // Access control tags (comma-separated IDs)

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Document name is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!validateFileType(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed. Please upload PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, or image files.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > getFileSizeLimit()) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Upload to S3
    const uploadResult = await uploadToS3({
      file: fileBuffer,
      fileName: file.name,
      mimeType: file.type,
      tenantId: tenant.id,
      userId: user.id,
    });

    // Parse access tag IDs
    const accessTagIdsArray = accessTagIds 
      ? accessTagIds.split(',').map(id => id.trim()).filter(id => id.length > 0)
      : [];

    // Validate access tags if provided
    if (accessTagIdsArray.length > 0) {
      const validTags = await prisma.tag.findMany({
        where: {
          id: { in: accessTagIdsArray },
          tenantId: tenant.id,
        },
      });

      if (validTags.length !== accessTagIdsArray.length) {
        return NextResponse.json(
          { error: 'One or more access tags not found or do not belong to this tenant' },
          { status: 400 }
        );
      }
    }

    // Save document to database
    let document = await prisma.document.create({
      data: {
        name: name.trim(),
        originalName: file.name,
        description: description?.trim() || null,
        fileUrl: uploadResult.url,
        fileKey: uploadResult.key,
        fileSize: uploadResult.size,
        mimeType: uploadResult.mimeType,
        submittedBy: user.id,
        tenantId: tenant.id,
        accessTags: {
          connect: accessTagIdsArray.map(tagId => ({ id: tagId })),
        },
      },
      include: {
        submittedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Auto-approve for admin uploads: process and embed the document
    let autoApproved = false;
    try {
      console.log(`🔄 Auto-approving admin upload: ${document.name}`);
      
      // Load document text based on file type
      let text: string;
      
      if (uploadResult.mimeType === 'application/pdf') {
        console.log(`📄 Processing PDF document: ${document.name}`);
        text = await loadPDFText(uploadResult.url);
      } else if (WORD_MIME_TYPES.includes(uploadResult.mimeType)) {
        console.log(`📝 Processing Word document: ${document.name} (${uploadResult.mimeType})`);
        text = await loadDOCXText(uploadResult.url);
      } else {
        console.log(`📃 Processing text document: ${document.name} (${uploadResult.mimeType})`);
        text = await loadFileText(uploadResult.url, uploadResult.mimeType);
      }

      if (text && text.trim() !== '') {
        console.log(`📊 Extracted ${text.length} characters from document`);

        // Prepend document name and description for better semantic search
        const metadataPrefix = `Document Title: ${document.name}\n${description?.trim() ? `Description: ${description.trim()}\n\n` : '\n'}`;
        const textWithMetadata = metadataPrefix + text;

        console.log(`📝 Added metadata prefix (${metadataPrefix.length} chars) to document content`);

        // Process and embed the document
        await processAndEmbedDocument(document.id, textWithMetadata);
        console.log(`✅ Document ${document.id} processed and embedded successfully`);

        // Update document status to APPROVED
        document = await prisma.document.update({
          where: { id: document.id },
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
              },
            },
          },
        });
        autoApproved = true;
      } else {
        console.warn(`⚠️ No text content extracted from ${document.name}, leaving as PENDING`);
      }
    } catch (embedError) {
      console.error('⚠️ Auto-approval failed, document will remain pending:', embedError);
      // Document remains in PENDING status, admin can manually approve later
    }

    return NextResponse.json({
      message: autoApproved 
        ? 'Document uploaded and automatically approved' 
        : 'Document uploaded successfully (pending manual approval)',
      document: {
        id: document.id,
        name: document.name,
        originalName: document.originalName,
        description: document.description,
        fileUrl: document.fileUrl,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        status: document.status,
        submittedBy: document.submittedByUser,
        createdAt: document.createdAt,
        autoApproved,
      },
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
