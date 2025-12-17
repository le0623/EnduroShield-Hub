import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDocumentAccessWhereClause } from '@/lib/tags';

/**
 * Extract keywords and key points from document chunks
 * Simple text analysis to find important terms and phrases
 */
function extractKeywordsAndKeyPoints(chunks: Array<{ content: string; documentId: string; documentName: string }>): {
  keywords: Array<{ term: string; count: number; documents: string[] }>;
  keyPoints: Array<{ text: string; documentId: string; documentName: string }>;
} {
  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
    'from', 'into', 'onto', 'upon', 'about', 'above', 'below', 'between', 'among', 'through', 'during',
    'before', 'after', 'while', 'if', 'then', 'else', 'because', 'although', 'however', 'therefore',
  ]);

  // Extract keywords (important terms)
  const termCounts = new Map<string, { count: number; documents: Set<string> }>();

  chunks.forEach((chunk) => {
    // Simple extraction: split by spaces, remove punctuation, filter stop words
    const words = chunk.content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word));

    // Count terms and track which documents they appear in
    words.forEach((word) => {
      if (!termCounts.has(word)) {
        termCounts.set(word, { count: 0, documents: new Set() });
      }
      const entry = termCounts.get(word)!;
      entry.count++;
      entry.documents.add(chunk.documentId);
    });
  });

  // Get top keywords (appearing in multiple documents or frequently)
  const keywords = Array.from(termCounts.entries())
    .map(([term, data]) => ({
      term,
      count: data.count,
      documents: Array.from(data.documents),
    }))
    .filter((kw) => kw.count >= 2 || kw.documents.length > 1) // At least 2 occurrences or in multiple docs
    .sort((a, b) => {
      // Sort by document count first, then by total count
      if (b.documents.length !== a.documents.length) {
        return b.documents.length - a.documents.length;
      }
      return b.count - a.count;
    })
    .slice(0, 50) // Top 50 keywords
    .map((kw) => ({
      term: kw.term.charAt(0).toUpperCase() + kw.term.slice(1),
      count: kw.count,
      documents: kw.documents,
    }));

  // Extract key points (important sentences/phrases from chunks)
  const keyPoints: Array<{ text: string; documentId: string; documentName: string }> = [];

  chunks.forEach((chunk) => {
    // Extract sentences that might be key points
    const sentences = chunk.content
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && s.length < 200); // Reasonable length

    // Take first few sentences from each chunk as potential key points
    sentences.slice(0, 2).forEach((sentence) => {
      // Check if sentence contains important keywords
      const hasKeywords = keywords.some((kw) =>
        sentence.toLowerCase().includes(kw.term.toLowerCase())
      );

      if (hasKeywords || sentence.length > 50) {
        keyPoints.push({
          text: sentence.length > 150 ? sentence.substring(0, 150) + '...' : sentence,
          documentId: chunk.documentId,
          documentName: chunk.documentName,
        });
      }
    });
  });

  // Limit key points and remove duplicates
  const uniqueKeyPoints = keyPoints
    .slice(0, 30)
    .filter((kp, index, self) =>
      index === self.findIndex((k) => k.text.substring(0, 50) === kp.text.substring(0, 50))
    );

  return { keywords, keyPoints: uniqueKeyPoints };
}

// GET /api/knowledge-base/explore - Get keywords, key points, and popular articles
export async function GET(request: NextRequest) {
  try {
    const { user, tenant } = await requireTenant(request);

    // Get base where clause with tag-based access control
    const accessWhere = await getDocumentAccessWhereClause(user.id, tenant.id);

    // Get all approved documents with active versions
    const documents = await prisma.document.findMany({
      where: {
        ...accessWhere,
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
      take: 100, // Limit for performance
    });

    if (documents.length === 0) {
      return NextResponse.json({
        keywords: [],
        keyPoints: [],
        popularArticles: [],
        categories: [],
      });
    }

    // Get chunks from these documents
    const documentIds = documents.map((d) => d.id);
    const chunks = await prisma.documentChunk.findMany({
      where: {
        version: {
          status: 'APPROVED',
          document: {
            id: { in: documentIds },
            activeVersionId: { not: null },
            activeVersion: {
              status: 'APPROVED',
            },
          },
          activeForDocument: {
            isNot: null,
          },
        },
      },
      include: {
        version: {
          select: {
            document: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      take: 1000, // Limit chunks for performance
    });

    // Extract keywords and key points
    const chunkData = chunks.map((chunk) => ({
      content: chunk.content,
      documentId: chunk.version.document.id,
      documentName: chunk.version.document.name,
    }));

    const { keywords, keyPoints } = extractKeywordsAndKeyPoints(chunkData);

    // Get popular articles (most recently updated, or could be based on views in future)
    const popularArticles = documents
      .slice(0, 10)
      .map((doc) => ({
        id: doc.id,
        title: doc.name,
        description: doc.description,
        categories: doc.accessTags.map((tag) => ({
          id: tag.id,
          name: tag.name,
        })),
        fileUrl: doc.activeVersion?.fileUrl,
        fileName: doc.activeVersion?.originalName,
        updatedAt: doc.updatedAt,
      }));

    // Get categories
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
      keywords: keywords.slice(0, 30), // Top 30 keywords
      keyPoints: keyPoints.slice(0, 20), // Top 20 key points
      popularArticles,
      categories: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        count: cat._count.documents,
      })),
    });
  } catch (error) {
    console.error('Error fetching knowledge base explore data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch knowledge base data' },
      { status: 500 }
    );
  }
}
