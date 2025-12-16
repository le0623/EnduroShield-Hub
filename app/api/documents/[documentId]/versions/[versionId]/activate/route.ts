import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/documents/[documentId]/versions/[versionId]/activate - Activate a specific version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string; versionId: string }> }
) {
  try {
    const { documentId, versionId } = await params;
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
        { error: 'Only administrators can switch document versions' },
        { status: 403 }
      );
    }

    // Get the document
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

    // Get the version to activate
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

    // Check if version is approved
    if (version.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only approved versions can be activated' },
        { status: 400 }
      );
    }

    // Set this version as the active version
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: { activeVersionId: versionId },
      include: {
        activeVersion: {
          include: {
            uploadedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      message: `Version ${version.versionNumber} is now active`,
      document: {
        id: updatedDocument.id,
        name: updatedDocument.name,
        activeVersionId: updatedDocument.activeVersionId,
        activeVersion: updatedDocument.activeVersion ? {
          id: updatedDocument.activeVersion.id,
          versionNumber: updatedDocument.activeVersion.versionNumber,
          originalName: updatedDocument.activeVersion.originalName,
          fileUrl: updatedDocument.activeVersion.fileUrl,
          status: updatedDocument.activeVersion.status,
          uploadedBy: updatedDocument.activeVersion.uploadedByUser,
        } : null,
      },
    });
  } catch (error) {
    console.error('Error activating version:', error);
    return NextResponse.json(
      { error: 'Failed to activate version' },
      { status: 500 }
    );
  }
}
