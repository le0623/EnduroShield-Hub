import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateRAGAnswer } from '@/lib/rag/rag';
import { checkBalance } from '@/lib/billing';

// GET /api/conversations/[conversationId]/messages - Get all messages in a conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    const { user, tenant } = await requireTenant(request);

    // Verify conversation belongs to user and tenant
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: user.id,
        tenantId: tenant.id,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json({
      messages: messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST /api/conversations/[conversationId]/messages - Send a message and get AI response
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { conversationId } = await params;
    const { user, tenant } = await requireTenant(request);
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    // Verify conversation belongs to user and tenant
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        userId: user.id,
        tenantId: tenant.id,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      // Save user message
      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'USER',
          content: content.trim(),
        },
      });

      // Save assistant response
      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          content: 'OpenAI API key is not configured. Please configure it in the integration settings.',
        },
      });

      // Update conversation updatedAt
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return NextResponse.json({
        userMessage: {
          id: userMessage.id,
          role: userMessage.role,
          content: userMessage.content,
          createdAt: userMessage.createdAt,
        },
        assistantMessage: {
          id: assistantMessage.id,
          role: assistantMessage.role,
          content: assistantMessage.content,
          createdAt: assistantMessage.createdAt,
        },
      });
    }

    // Check if there are approved documents with embeddings
    const approvedDocumentsCount = await prisma.document.count({
      where: {
        tenantId: tenant.id,
        status: 'APPROVED',
      },
    });

    if (approvedDocumentsCount === 0) {
      // Save user message
      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'USER',
          content: content.trim(),
        },
      });

      // Save assistant response
      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          content: 'No knowledge base initialized. Please upload and approve documents first to enable AI-powered responses.',
        },
      });

      // Update conversation updatedAt
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return NextResponse.json({
        userMessage: {
          id: userMessage.id,
          role: userMessage.role,
          content: userMessage.content,
          createdAt: userMessage.createdAt,
        },
        assistantMessage: {
          id: assistantMessage.id,
          role: assistantMessage.role,
          content: assistantMessage.content,
          createdAt: assistantMessage.createdAt,
        },
      });
    }

    // Check tenant balance before processing
    const { hasBalance, balance } = await checkBalance(tenant.id);
    if (!hasBalance) {
      // Save user message
      const userMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'USER',
          content: content.trim(),
        },
      });

      // Save assistant response about insufficient balance
      const assistantMessage = await prisma.message.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          content: '⚠️ Insufficient balance. Your account balance has been depleted. Please contact your administrator to add credits and continue using the AI search service.',
        },
      });

      // Update conversation updatedAt
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      return NextResponse.json({
        userMessage: {
          id: userMessage.id,
          role: userMessage.role,
          content: userMessage.content,
          createdAt: userMessage.createdAt,
        },
        assistantMessage: {
          id: assistantMessage.id,
          role: assistantMessage.role,
          content: assistantMessage.content,
          createdAt: assistantMessage.createdAt,
        },
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: 'Insufficient balance. Please add credits to continue.',
          balance: balance,
        },
      }, { status: 402 });
    }

    // Get conversation history for context
    const previousMessages = await prisma.message.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Convert to RAG format
    const conversationHistory = previousMessages.map((msg) => ({
      role: msg.role as 'USER' | 'ASSISTANT',
      content: msg.content,
    }));

    // Generate answer using RAG (with user tag filtering)
    const assistantResponse = await generateRAGAnswer(
      content.trim(),
      tenant.id,
      conversationHistory,
      user.id
    );

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'USER',
        content: content.trim(),
      },
    });

    // Save assistant response
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: assistantResponse,
      },
    });

    // Update conversation title if it's the first message
    if (previousMessages.length === 0) {
      // Use first 50 characters of the first message as title
      const title = content.trim().substring(0, 50) + (content.trim().length > 50 ? '...' : '');
      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          title,
          updatedAt: new Date(),
        },
      });
    } else {
      // Update conversation updatedAt
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    }

    return NextResponse.json({
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error sending message:', error);

    // Handle OpenAI API errors
    if (error.response) {
      return NextResponse.json(
        { error: `OpenAI API error: ${error.response.data?.error?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

