import { NextRequest, NextResponse } from 'next/server';
import { extractSubdomain } from '@/lib/subdomain';
import { prisma } from '@/lib/prisma';
import { verifyApiKey, isApiKeyExpired, checkDailyLimit, checkMonthlyLimit, trackApiKeyUsage } from '@/lib/api-keys';
import { generateRAGAnswerWithUsage } from '@/lib/rag/rag';
import { checkBalance } from '@/lib/billing';

// POST /api/query - Public API for AI-powered search (authenticated by API key)
export async function POST(request: NextRequest) {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header. Use: Authorization: Bearer <api_key>' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.substring(7); // Remove "Bearer " prefix

    // Extract subdomain from request
    const subdomain = extractSubdomain(request);
    if (!subdomain) {
      return NextResponse.json(
        { error: 'Invalid subdomain. API must be accessed via [subdomain].rootdomain.com/api/query' },
        { status: 400 }
      );
    }

    // Find tenant by subdomain
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Find API key by hash
    const allApiKeys = await prisma.apiKey.findMany({
      where: {
        tenantId: tenant.id,
        isEnabled: true,
      },
    });

    // Find matching API key by verifying hash
    let matchedApiKey = null;
    for (const key of allApiKeys) {
      if (verifyApiKey(apiKey, key.keyHash)) {
        matchedApiKey = key;
        break;
      }
    }

    if (!matchedApiKey) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Check if API key is expired
    if (isApiKeyExpired(matchedApiKey.expirationDate)) {
      return NextResponse.json(
        { error: 'API key has expired' },
        { status: 401 }
      );
    }

    // Check daily limit
    const withinDailyLimit = await checkDailyLimit(matchedApiKey.id);
    if (!withinDailyLimit) {
      return NextResponse.json(
        { error: 'Daily usage limit exceeded' },
        { status: 429 }
      );
    }

    // Check monthly limit
    const withinMonthlyLimit = await checkMonthlyLimit(matchedApiKey.id);
    if (!withinMonthlyLimit) {
      return NextResponse.json(
        { error: 'Monthly usage limit exceeded' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { query, conversationHistory } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Validate conversation history format if provided
    const history = conversationHistory || [];
    if (!Array.isArray(history)) {
      return NextResponse.json(
        { error: 'conversationHistory must be an array' },
        { status: 400 }
      );
    }

    // Check if tenant has approved documents
    const approvedDocumentsCount = await prisma.document.count({
      where: {
        tenantId: tenant.id,
        status: 'APPROVED',
      },
    });

    if (approvedDocumentsCount === 0) {
      return NextResponse.json(
        { error: 'No knowledge base available. Please upload and approve documents first.' },
        { status: 503 }
      );
    }

    // Check tenant balance before processing
    const { hasBalance, balance } = await checkBalance(tenant.id);
    if (!hasBalance) {
      return NextResponse.json(
        { 
          error: 'Insufficient balance. Please add credits to continue using the API.',
          code: 'INSUFFICIENT_BALANCE',
          balance: balance,
        },
        { status: 402 } // Payment Required
      );
    }

    // For API keys (not logged-in users), access documents with no access tags (public documents)
    // API keys don't have user tags, so they can only access public documents
    // Note: In the future, API keys could have tags assigned to them for more granular access control
    const { answer, usage } = await generateRAGAnswerWithUsage(
      query.trim(),
      tenant.id,
      history.map((msg: any) => ({
        role: msg.role === 'user' ? 'USER' : 'ASSISTANT',
        content: msg.content,
      })),
      undefined, // No userId for API keys - they access public documents only
      true // Skip balance check since we already checked above
    );

    // Track API key usage with actual cost
    const actualCost = usage?.cost || 0.001;
    await trackApiKeyUsage(matchedApiKey.id, actualCost);

    return NextResponse.json({
      answer,
      query: query.trim(),
      timestamp: new Date().toISOString(),
      usage: usage ? {
        tokens: usage.totalTokens,
        cost: usage.cost,
      } : undefined,
    });
  } catch (error: any) {
    console.error('Error in query API:', error);
    
    // Handle insufficient balance error from RAG
    if (error.message?.startsWith('INSUFFICIENT_BALANCE:')) {
      const balance = parseFloat(error.message.split(':')[1]) || 0;
      return NextResponse.json(
        { 
          error: 'Insufficient balance. Please add credits to continue using the API.',
          code: 'INSUFFICIENT_BALANCE',
          balance: balance,
        },
        { status: 402 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/query - API documentation
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'EnduroShield Hub AI-Powered Search API',
    version: '1.0.0',
    endpoints: {
      query: {
        method: 'POST',
        path: '/api/query',
        description: 'Perform AI-powered search on the knowledge base',
        authentication: 'Bearer token (API key)',
        headers: {
          'Authorization': 'Bearer <your_api_key>',
          'Content-Type': 'application/json',
        },
        body: {
          query: 'string (required) - The search query',
          conversationHistory: 'array (optional) - Previous conversation messages for context',
        },
        example: {
          query: 'What is the company policy on remote work?',
          conversationHistory: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi! How can I help you?' },
          ],
        },
        response: {
          answer: 'string - The AI-generated answer',
          query: 'string - The original query',
          timestamp: 'string - ISO timestamp',
        },
      },
    },
    usage: {
      rateLimits: 'Daily and monthly limits are configurable per API key',
      cost: 'Usage is tracked and billed based on API key limits',
    },
  });
}

