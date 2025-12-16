import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deleteFromS3 } from '@/lib/s3';
import { canUserAccessDocument } from '@/lib/tags';

// GET /api/documents/[documentId] - Get a specific document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const { user, tenant } = await requireTenant(request);

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        tenantId: tenant.id,
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
        activeVersion: {
          select: {
            id: true,
            versionNumber: true,
            originalName: true,
            fileUrl: true,
            fileKey: true,
            fileSize: true,
            mimeType: true,
            status: true,
            approvedAt: true,
            rejectedAt: true,
            rejectionReason: true,
            approvedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            rejectedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        accessTags: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Check if user can access this document based on tags
    const canAccess = await canUserAccessDocument(user.id, tenant.id, documentId);
    if (!canAccess) {
      return NextResponse.json(
        { error: 'You do not have permission to access this document' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      document: {
        id: document.id,
        name: document.name,
        description: document.description,
        accessTags: document.accessTags.map(tag => ({
          id: tag.id,
          name: tag.name,
        })),
        originalName: document.activeVersion?.originalName,
        fileUrl: document.activeVersion?.fileUrl,
        fileKey: document.activeVersion?.fileKey,
        fileSize: document.activeVersion?.fileSize,
        mimeType: document.activeVersion?.mimeType,
        version: document.activeVersion?.versionNumber,
        status: document.activeVersion?.status,
        submittedBy: document.submittedByUser,
        approvedBy: document.activeVersion?.approvedByUser,
        rejectedBy: document.activeVersion?.rejectedByUser,
        rejectionReason: document.activeVersion?.rejectionReason,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        approvedAt: document.activeVersion?.approvedAt,
        rejectedAt: document.activeVersion?.rejectedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

// PUT /api/documents/[documentId] - Update document metadata
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const { user, tenant } = await requireTenant(request);

    const body = await request.json();
    const { name, description } = body;

    // Check if user has permission to update document
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

    // Get user's role in this tenant
    const userMembership = await prisma.tenantMember.findFirst({
      where: {
        userId: user.id,
        tenantId: tenant.id,
      },
    });

    // Only document submitter or admin can update document metadata
    if (document.submittedBy !== user.id && (!userMembership || userMembership.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update document' },
        { status: 403 }
      );
    }

    // Update document
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
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
        activeVersion: {
          select: {
            id: true,
            versionNumber: true,
            originalName: true,
            fileUrl: true,
            fileKey: true,
            fileSize: true,
            mimeType: true,
            status: true,
            approvedAt: true,
            rejectedAt: true,
            rejectionReason: true,
            approvedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            rejectedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        accessTags: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Document updated successfully',
      document: {
        id: updatedDocument.id,
        name: updatedDocument.name,
        description: updatedDocument.description,
        accessTags: updatedDocument.accessTags.map(tag => ({
          id: tag.id,
          name: tag.name,
        })),
        originalName: updatedDocument.activeVersion?.originalName,
        fileUrl: updatedDocument.activeVersion?.fileUrl,
        fileKey: updatedDocument.activeVersion?.fileKey,
        fileSize: updatedDocument.activeVersion?.fileSize,
        mimeType: updatedDocument.activeVersion?.mimeType,
        version: updatedDocument.activeVersion?.versionNumber,
        status: updatedDocument.activeVersion?.status,
        submittedBy: updatedDocument.submittedByUser,
        approvedBy: updatedDocument.activeVersion?.approvedByUser,
        rejectedBy: updatedDocument.activeVersion?.rejectedByUser,
        rejectionReason: updatedDocument.activeVersion?.rejectionReason,
        createdAt: updatedDocument.createdAt,
        updatedAt: updatedDocument.updatedAt,
        approvedAt: updatedDocument.activeVersion?.approvedAt,
        rejectedAt: updatedDocument.activeVersion?.rejectedAt,
      },
    });
  } catch (error) {
    console.error('Error updating document:', error);
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
}

// DELETE /api/documents/[documentId] - Delete document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const { user, tenant } = await requireTenant(request);

    // Check if user has permission to delete document
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        tenantId: tenant.id,
      },
      include: {
        versions: {
          select: {
            fileKey: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get user's role in this tenant
    const userMembership = await prisma.tenantMember.findFirst({
      where: {
        userId: user.id,
        tenantId: tenant.id,
      },
    });

    // Only document submitter or admin can delete document
    if (document.submittedBy !== user.id && (!userMembership || userMembership.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete document' },
        { status: 403 }
      );
    }

    // Delete all versions from S3
    for (const version of document.versions) {
      if (version.fileKey) {
        await deleteFromS3(version.fileKey);
      }
    }

    // Delete from database
    await prisma.document.delete({
      where: { id: documentId },
    });

    return NextResponse.json({
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
