import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canUserAccessDocument } from '@/lib/tags';

// GET /api/knowledge-base/[articleId] - Get a single KB article
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> }
) {
  try {
    const { articleId } = await params;
    const { user, tenant } = await requireTenant(request);

    // Check if user can access this document
    const canAccess = await canUserAccessDocument(user.id, tenant.id, articleId);
    if (!canAccess) {
      return NextResponse.json(
        { error: 'You do not have permission to access this article' },
        { status: 403 }
      );
    }

    const document = await prisma.document.findFirst({
      where: {
        id: articleId,
        tenantId: tenant.id,
        activeVersionId: { not: null },
        activeVersion: {
          status: 'APPROVED',
        },
      },
      include: {
        activeVersion: {
          select: {
            id: true,
            versionNumber: true,
            originalName: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            status: true,
            createdAt: true,
            approvedAt: true,
          },
        },
        accessTags: {
          select: {
            id: true,
            name: true,
          },
        },
        submittedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!document || !document.activeVersion) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      article: {
        id: document.id,
        title: document.name,
        description: document.description,
        categories: document.accessTags.map((tag) => ({
          id: tag.id,
          name: tag.name,
        })),
        fileUrl: document.activeVersion.fileUrl,
        fileName: document.activeVersion.originalName,
        fileSize: document.activeVersion.fileSize,
        mimeType: document.activeVersion.mimeType,
        version: document.activeVersion.versionNumber,
        submittedBy: document.submittedByUser,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        approvedAt: document.activeVersion.approvedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching knowledge base article:', error);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge base article' },
      { status: 500 }
    );
  }
}
