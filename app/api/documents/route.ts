import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDocumentAccessWhereClause } from '@/lib/tags';

// GET /api/documents - Get all documents for the tenant
export async function GET(request: NextRequest) {
  try {
    const { user, tenant } = await requireTenant(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Get base where clause with tag-based access control
    const accessWhere = await getDocumentAccessWhereClause(user.id, tenant.id);

    // Build where clause combining access control with filters
    const whereConditions: unknown[] = [accessWhere];

    // Filter by version status if specified
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      whereConditions.push({
        versions: {
          some: { status },
        },
      });
    }

    if (search) {
      // Add search filters
      whereConditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { submittedByUser: { name: { contains: search, mode: 'insensitive' } } },
          { submittedByUser: { email: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    // Combine all conditions with AND (if multiple conditions)
    const where = whereConditions.length === 1 ? whereConditions[0] : { AND: whereConditions };

    // Get documents with pagination
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          submittedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImageUrl: true,
            },
          },
          accessTags: {
            select: {
              id: true,
              name: true,
            },
          },
          activeVersion: {
            select: {
              id: true,
              versionNumber: true,
              originalName: true,
              fileUrl: true,
              fileSize: true,
              mimeType: true,
              status: true,
              approvedAt: true,
              rejectedAt: true,
              rejectionReason: true,
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
              rejectedByUser: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1, // Get latest version for display
            select: {
              id: true,
              versionNumber: true,
              originalName: true,
              fileUrl: true,
              fileSize: true,
              mimeType: true,
              status: true,
              approvedAt: true,
              rejectedAt: true,
              rejectionReason: true,
              createdAt: true,
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
              rejectedByUser: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
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

    // Format response - use latest version data for display
    const formattedDocuments = documents.map(doc => {
      const latestVersion = doc.versions[0];
      const activeVersion = doc.activeVersion;
      
      return {
        id: doc.id,
        name: doc.name,
        description: doc.description,
        accessTags: doc.accessTags.map(tag => ({
          id: tag.id,
          name: tag.name,
        })),
        // Use latest version info for display
        originalName: latestVersion?.originalName || '',
        fileUrl: latestVersion?.fileUrl || '',
        fileSize: latestVersion?.fileSize || 0,
        mimeType: latestVersion?.mimeType || '',
        // Version info
        version: doc.currentVersion,
        latestVersionNumber: latestVersion?.versionNumber || 1,
        activeVersionNumber: activeVersion?.versionNumber || null,
        hasActiveVersion: !!activeVersion,
        // Status from latest version
        status: latestVersion?.status || 'PENDING',
        // User info
        submittedBy: doc.submittedByUser,
        approvedBy: latestVersion?.approvedByUser || null,
        rejectedBy: latestVersion?.rejectedByUser || null,
        rejectionReason: latestVersion?.rejectionReason || null,
        // Dates
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        approvedAt: latestVersion?.approvedAt || null,
        rejectedAt: latestVersion?.rejectedAt || null,
      };
    });

    return NextResponse.json({
      documents: formattedDocuments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
