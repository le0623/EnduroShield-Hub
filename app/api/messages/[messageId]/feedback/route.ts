import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH /api/messages/[messageId]/feedback - Update message feedback
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const { user, tenant } = await requireTenant(request);
    const body = await request.json();
    const { feedback } = body;

    // Validate feedback value
    if (feedback !== null && feedback !== 'POSITIVE' && feedback !== 'NEGATIVE') {
      return NextResponse.json(
        { error: 'Invalid feedback value. Must be POSITIVE, NEGATIVE, or null' },
        { status: 400 }
      );
    }

    // Find the message and verify it belongs to user's conversation
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversation: {
          userId: user.id,
          tenantId: tenant.id,
        },
      },
      include: {
        conversation: true,
      },
    });

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Only allow feedback on assistant messages
    if (message.role !== 'ASSISTANT') {
      return NextResponse.json(
        { error: 'Feedback can only be provided for assistant messages' },
        { status: 400 }
      );
    }

    // Update the message feedback
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { feedback },
    });

    return NextResponse.json({
      message: {
        id: updatedMessage.id,
        feedback: updatedMessage.feedback,
      },
    });
  } catch (error) {
    console.error('Error updating message feedback:', error);
    return NextResponse.json(
      { error: 'Failed to update feedback' },
      { status: 500 }
    );
  }
}

