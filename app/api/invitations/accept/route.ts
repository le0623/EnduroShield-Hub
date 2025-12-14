import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// POST /api/invitations/accept - Accept invitation and create user account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, name, password } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Find invitation by token
    const invitation = await prisma.userInvitation.findUnique({
      where: { token },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 400 }
      );
    }

    // Check if invitation is still pending
    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Invitation has already been used or expired' },
        { status: 400 }
      );
    }

    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      await prisma.userInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });

      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
      include: {
        tenants: {
          where: {
            tenantId: invitation.tenantId,
          },
        },
      },
    });

    let user;
    
    if (existingUser) {
      // User already exists - check if they already belong to this tenant
      if (existingUser.tenants.length > 0) {
        return NextResponse.json(
          { error: 'You are already a member of this organization' },
          { status: 400 }
        );
      }

      // User exists but doesn't belong to this tenant - just add them
      // Update user name if provided
      if (name && name.trim()) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { name: name.trim() },
        });
      }

      user = {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name || name,
        status: existingUser.status,
      };

      // Create tenant membership with tags
      await prisma.tenantMember.create({
        data: {
          userId: existingUser.id,
          tenantId: invitation.tenantId,
          role: invitation.role || null, // Only ADMIN or null
          isOwner: false,
          tags: {
            connect: invitation.tagIds?.map((tagId: string) => ({ id: tagId })) || [],
          },
        },
      });

      // Update invitation status
      await prisma.userInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });

      return NextResponse.json({
        message: 'Successfully joined organization',
        user: user,
        isNewUser: false,
        tenant: invitation.tenant,
      });
    } else {
      // New user - create account
      if (!name || !password) {
        return NextResponse.json(
          { error: 'Name and password are required for new accounts' },
          { status: 400 }
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user account
      const newUser = await prisma.user.create({
        data: {
          email: invitation.email,
          name,
          password: hashedPassword,
          invitationId: invitation.id,
          emailVerified: new Date(),
        },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
        },
      });

      // Create tenant membership with tags
      await prisma.tenantMember.create({
        data: {
          userId: newUser.id,
          tenantId: invitation.tenantId,
          role: invitation.role || null, // Only ADMIN or null
          isOwner: false,
          tags: {
            connect: invitation.tagIds?.map((tagId: string) => ({ id: tagId })) || [],
          },
        },
      });

      // Update invitation status
      await prisma.userInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });

      return NextResponse.json({
        message: 'Account created successfully',
        user: newUser,
        isNewUser: true,
        tenant: invitation.tenant,
      });
    }
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
