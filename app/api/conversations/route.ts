import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/conversations - Get all conversations for the current user and tenant
export async function GET(request: NextRequest) {
  try {
    const { user, tenant } = await requireTenant(request);

    const conversations = await prisma.conversation.findMany({
      where: {
        userId: user.id,
        tenantId: tenant.id,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
          take: 1, // Get first message for preview
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json({
      conversations: conversations.map((conv) => ({
        id: conv.id,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messageCount: conv._count.messages,
        preview: conv.messages[0]?.content || '',
      })),
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

// POST /api/conversations - Create a new conversation
export async function POST(request: NextRequest) {
  try {
    const { user, tenant } = await requireTenant(request);
    const body = await request.json();
    const { title } = body;

    // Check if there are approved documents
    const approvedDocuments = await prisma.document.findMany({
      where: {
        tenantId: tenant.id,
        versions: {
          some: {
            status: 'APPROVED',
            chunks: {
              some: {},
            },
          },
        },
      },
      take: 1,
    });

    if (approvedDocuments.length === 0) {
      return NextResponse.json(
        { error: 'No knowledge base initialized. Please upload and approve documents first.' },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.create({
      data: {
        title: title || 'New Conversation',
        userId: user.id,
        tenantId: tenant.id,
      },
    });

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}

