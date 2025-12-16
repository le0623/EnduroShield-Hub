import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadToS3, validateFileType, getFileSizeLimit } from '@/lib/s3';
import { processAndEmbedVersion } from '@/lib/rag/embeddings';
import { loadFileText, loadPDFText, loadDOCXText } from '@/lib/utils/fileLoader';

// DOCX and DOC MIME types for auto-approval processing
const WORD_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/docx',
  'application/msword', // .doc
];

// GET /api/documents/[documentId]/versions - Get all versions of a document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const { tenant } = await requireTenant(request);

    // Get document with all versions
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        tenantId: tenant.id,
      },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            uploadedByUser: {
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
        },
        activeVersion: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      documentId: document.id,
      documentName: document.name,
      currentVersion: document.currentVersion,
      activeVersionId: document.activeVersionId,
      versions: document.versions.map(v => ({
        id: v.id,
        versionNumber: v.versionNumber,
        originalName: v.originalName,
        fileUrl: v.fileUrl,
        fileSize: v.fileSize,
        mimeType: v.mimeType,
        status: v.status,
        changeNotes: v.changeNotes,
        uploadedBy: v.uploadedByUser,
        approvedBy: v.approvedByUser,
        createdAt: v.createdAt,
        approvedAt: v.approvedAt,
        isActive: v.id === document.activeVersionId,
      })),
    });
  } catch (error) {
    console.error('Error fetching document versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch versions' },
      { status: 500 }
    );
  }
}

// POST /api/documents/[documentId]/versions - Upload a new version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const { user, tenant } = await requireTenant(request);

    // Get user's role
    const userMembership = await prisma.tenantMember.findFirst({
      where: {
        userId: user.id,
        tenantId: tenant.id,
      },
    });

    if (!userMembership || userMembership.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only administrators can upload new versions' },
        { status: 403 }
      );
    }

    // Get existing document
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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const changeNotes = formData.get('changeNotes') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!validateFileType(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
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

    // Convert file to buffer and upload to S3
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await uploadToS3({
      file: fileBuffer,
      fileName: file.name,
      mimeType: file.type,
      tenantId: tenant.id,
      userId: user.id,
    });

    // Create new version with incremented version number
    const newVersionNumber = document.currentVersion + 1;

    let version = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber: newVersionNumber,
        originalName: file.name,
        fileUrl: uploadResult.url,
        fileKey: uploadResult.key,
        fileSize: uploadResult.size,
        mimeType: uploadResult.mimeType,
        uploadedBy: user.id,
        changeNotes: changeNotes?.trim() || null,
        status: 'PENDING',
      },
    });

    // Update document's current version number
    await prisma.document.update({
      where: { id: document.id },
      data: { currentVersion: newVersionNumber },
    });

    let autoApproved = false;

    // Auto-approve for admin uploads
    try {
      console.log(`🔄 Auto-approving new version ${newVersionNumber} for: ${document.name}`);
      
      let text: string;
      
      if (uploadResult.mimeType === 'application/pdf') {
        text = await loadPDFText(uploadResult.url);
      } else if (WORD_MIME_TYPES.includes(uploadResult.mimeType)) {
        text = await loadDOCXText(uploadResult.url);
      } else {
        text = await loadFileText(uploadResult.url, uploadResult.mimeType);
      }

      if (text && text.trim() !== '') {
        console.log(`📊 Extracted ${text.length} characters from version`);

        // Prepend document name and description
        const metadataPrefix = `Document Title: ${document.name}\n${document.description ? `Description: ${document.description}\n\n` : '\n'}`;
        const textWithMetadata = metadataPrefix + text;

        // Process and embed the version
        await processAndEmbedVersion(version.id, textWithMetadata);
        console.log(`✅ Version ${version.id} processed and embedded successfully`);

        // Update version status to APPROVED
        version = await prisma.documentVersion.update({
          where: { id: version.id },
          data: {
            status: 'APPROVED',
            approvedBy: user.id,
            approvedAt: new Date(),
          },
        });

        // Set this version as the active version
        await prisma.document.update({
          where: { id: document.id },
          data: { activeVersionId: version.id },
        });

        autoApproved = true;
      }
    } catch (embedError) {
      console.error('⚠️ Auto-approval failed:', embedError);
    }

    // Fetch the complete version data
    const fullVersion = await prisma.documentVersion.findUnique({
      where: { id: version.id },
      include: {
        uploadedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: autoApproved 
        ? 'New version uploaded and approved' 
        : 'New version uploaded (pending approval)',
      version: {
        id: fullVersion?.id,
        versionNumber: fullVersion?.versionNumber,
        originalName: fullVersion?.originalName,
        fileUrl: fullVersion?.fileUrl,
        fileSize: fullVersion?.fileSize,
        mimeType: fullVersion?.mimeType,
        status: fullVersion?.status,
        changeNotes: fullVersion?.changeNotes,
        uploadedBy: fullVersion?.uploadedByUser,
        createdAt: fullVersion?.createdAt,
        autoApproved,
      },
    });
  } catch (error) {
    console.error('Error uploading new version:', error);
    return NextResponse.json(
      { error: 'Failed to upload new version' },
      { status: 500 }
    );
  }
}
