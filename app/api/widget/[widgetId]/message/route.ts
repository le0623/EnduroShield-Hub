import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateRAGAnswer } from '@/lib/rag/rag';
import { checkBalance } from '@/lib/billing';

// POST /api/widget/[widgetId]/message - Send a message via widget
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ widgetId: string }> }
) {
  try {
    const { widgetId } = await params;
    const body = await request.json();
    const { conversationId, content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    // Get widget and tenant
    const widget = await prisma.widget.findUnique({
      where: { widgetId },
      include: { tenant: true },
    });

    if (!widget || !widget.enabled) {
      return NextResponse.json(
        { error: 'Widget not found or disabled' },
        { 
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    // Verify conversation belongs to widget's tenant
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId: widget.tenantId,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { 
          status: 404,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    // Get conversation history
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

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { 
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      );
    }

    // Check if there are approved documents with embeddings
    const approvedDocumentsCount = await prisma.document.count({
      where: {
        tenantId: widget.tenantId,
        status: 'APPROVED',
      },
    });

    let assistantResponse: string;
    if (approvedDocumentsCount === 0) {
      assistantResponse = 'No knowledge base initialized. Please upload and approve documents first to enable AI-powered responses.';
    } else {
      // Check tenant balance before processing
      const { hasBalance } = await checkBalance(widget.tenantId);
      if (!hasBalance) {
        assistantResponse = '⚠️ Service temporarily unavailable. Please contact the administrator.';
      } else {
        // Generate answer using RAG (no userId for widget - public access)
        assistantResponse = await generateRAGAnswer(
          content.trim(),
          widget.tenantId,
          conversationHistory
          // No userId - widget has public access to all approved documents
        );
      }
    }

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

    // Update conversation
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(
      {
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
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error) {
    console.error('Error sending widget message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
    return NextResponse.json(
      { error: errorMessage },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

