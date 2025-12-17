import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDocumentAccessWhereClause } from '@/lib/tags';

// GET /api/knowledge-base - Get approved documents for KB browsing
export async function GET(request: NextRequest) {
  try {
    const { user, tenant } = await requireTenant(request);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category'); // Tag name as category
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Get base where clause with tag-based access control
    const accessWhere = await getDocumentAccessWhereClause(user.id, tenant.id);

    // Build where clause combining access control with filters
    const whereConditions: unknown[] = [
      accessWhere,
      // Only show documents with approved active versions
      {
        activeVersionId: { not: null },
        activeVersion: {
          status: 'APPROVED',
        },
      },
    ];

    // Filter by category (tag)
    if (category) {
      whereConditions.push({
        accessTags: {
          some: {
            name: { equals: category, mode: 'insensitive' },
          },
        },
      });
    }

    // Search filter
    if (search) {
      whereConditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    // Combine all conditions with AND
    const where = whereConditions.length === 1 ? whereConditions[0] : { AND: whereConditions };

    // Get documents with pagination
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
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
            },
          },
          accessTags: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.document.count({ where }),
    ]);

    // Get all available categories (tags) for filtering
    const categories = await prisma.tag.findMany({
      where: {
        tenantId: tenant.id,
        documents: {
          some: {
            ...accessWhere,
            activeVersionId: { not: null },
            activeVersion: {
              status: 'APPROVED',
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            documents: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({
      articles: documents.map((doc) => ({
        id: doc.id,
        title: doc.name,
        description: doc.description,
        categories: doc.accessTags.map((tag) => ({
          id: tag.id,
          name: tag.name,
        })),
        fileUrl: doc.activeVersion?.fileUrl,
        fileName: doc.activeVersion?.originalName,
        fileSize: doc.activeVersion?.fileSize,
        mimeType: doc.activeVersion?.mimeType,
        version: doc.activeVersion?.versionNumber,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
      categories: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        count: cat._count.documents,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching knowledge base articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge base articles' },
      { status: 500 }
    );
  }
}
