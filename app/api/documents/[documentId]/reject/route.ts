import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/documents/[documentId]/reject - Reject a document
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
        { error: 'Only administrators can reject documents' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { reason } = body;

    if (!reason || reason.trim() === '') {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    // Check if document exists and belongs to tenant
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        tenantId: tenant.id,
      },
      include: {
        versions: {
          where: { status: 'PENDING' },
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get the latest pending version
    const pendingVersion = document.versions[0];
    
    if (!pendingVersion) {
      return NextResponse.json(
        { error: 'No pending version found for this document' },
        { status: 400 }
      );
    }

    // Reject version
    const rejectedVersion = await prisma.documentVersion.update({
      where: { id: pendingVersion.id },
      data: {
        status: 'REJECTED',
        rejectedBy: user.id,
        rejectionReason: reason.trim(),
        rejectedAt: new Date(),
      },
      include: {
        rejectedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Document rejected successfully',
      document: {
        id: document.id,
        name: document.name,
        version: rejectedVersion.versionNumber,
        status: rejectedVersion.status,
        rejectedBy: rejectedVersion.rejectedByUser,
        rejectionReason: rejectedVersion.rejectionReason,
        rejectedAt: rejectedVersion.rejectedAt,
      },
    });
  } catch (error) {
    console.error('Error rejecting document:', error);
    return NextResponse.json(
      { error: 'Failed to reject document' },
      { status: 500 }
    );
  }
}
