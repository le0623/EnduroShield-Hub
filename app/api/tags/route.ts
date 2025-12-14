import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/tags - Get all tags for the tenant (with user counts)
export async function GET(request: NextRequest) {
  try {
    const { user, tenant } = await requireTenant(request);

    // Check if user is admin or owner
    const membership = await prisma.tenantMember.findFirst({
      where: {
        userId: user.id,
        tenantId: tenant.id,
      },
    });

    if (!membership || (membership.role !== 'ADMIN' && !membership.isOwner)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only admins and owners can manage tags.' },
        { status: 403 }
      );
    }

    // Fetch tags with user count and document count in a single query
    const tags = await prisma.tag.findMany({
      where: {
        tenantId: tenant.id,
      },
      include: {
        _count: {
          select: {
            tenantMembers: true, // Count users with this tag
            documents: true,     // Count documents with this tag
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Transform the response to include userCount and documentCount at the top level
    const tagsWithCounts = tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
      userCount: tag._count.tenantMembers,
      documentCount: tag._count.documents,
    }));

    return NextResponse.json({ tags: tagsWithCounts });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}

// POST /api/tags - Create a new tag
export async function POST(request: NextRequest) {
  try {
    const { user, tenant } = await requireTenant(request);

    // Check if user is admin or owner
    const membership = await prisma.tenantMember.findFirst({
      where: {
        userId: user.id,
        tenantId: tenant.id,
      },
    });

    if (!membership || (membership.role !== 'ADMIN' && !membership.isOwner)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only admins and owners can manage tags.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Tag name is required' },
        { status: 400 }
      );
    }

    // Check if tag already exists
    const existingTag = await prisma.tag.findUnique({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: name.trim(),
        },
      },
    });

    if (existingTag) {
      return NextResponse.json(
        { error: 'Tag with this name already exists' },
        { status: 400 }
      );
    }

    const tag = await prisma.tag.create({
      data: {
        tenantId: tenant.id,
        name: name.trim(),
      },
    });

    return NextResponse.json({ tag });
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json(
      { error: 'Failed to create tag' },
      { status: 500 }
    );
  }
}

