import { prisma } from '../prisma';
import { generateEmbedding } from './embeddings';
import { getUserTagIds } from '../tags';

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Retrieve relevant document chunks for a query using vector similarity
 * Filters chunks based on user's access tags
 */
export async function retrieveRelevantChunks(
  query: string,
  tenantId: string,
  topK: number = 5,
  userId?: string // Optional: if provided, filter by user tags
): Promise<Array<{ content: string; documentId: string; documentName: string; documentUrl: string; chunkIndex: number; similarity: number }>> {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Build document filter with access control
    const documentWhere: any = {
      tenantId,
      status: 'APPROVED',
    };

    // If userId is provided, filter by user tags (unless user is admin)
    if (userId) {
      // Check if user is admin first
      const userMembership = await prisma.tenantMember.findFirst({
        where: {
          userId,
          tenantId,
        },
        select: {
          role: true,
          isOwner: true,
        },
      });

      // Admins can access all documents - don't add tag filter
      if (!userMembership || (userMembership.role !== 'ADMIN' && !userMembership.isOwner)) {
        const userTagIds = await getUserTagIds(userId, tenantId);

        if (userTagIds.length === 0) {
          // User has no tags, can only access documents with no access tags
          documentWhere.accessTags = { none: {} };
        } else {
          // User can access documents that:
          // 1. Have no access tags (accessible to all)
          // 2. Have at least one tag matching user's tags
          documentWhere.OR = [
            { accessTags: { none: {} } },
            { accessTags: { some: { id: { in: userTagIds } } } },
          ];
        }
      }
    }

    // Get all document chunks for approved documents in this tenant (with access control)
    const chunks = await prisma.documentChunk.findMany({
      where: {
        document: documentWhere,
      },
      include: {
        document: {
          select: {
            id: true,
            name: true,
            fileUrl: true,
          },
        },
      },
    });

    if (chunks.length === 0) {
      return [];
    }

    // Calculate similarity scores for all chunks
    const chunksWithSimilarity = chunks.map(chunk => {
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
      return {
        content: chunk.content,
        documentId: chunk.documentId,
        documentName: chunk.document.name,
        documentUrl: chunk.document.fileUrl,
        chunkIndex: chunk.chunkIndex,
        similarity,
      };
    });

    // Sort by similarity (descending) and take top K
    const topChunks = chunksWithSimilarity
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return topChunks.map(({ similarity, ...rest }) => ({ ...rest, similarity }));
  } catch (error) {
    console.error('Error retrieving relevant chunks:', error);
    throw error;
  }
}

/**
 * Build context string from retrieved chunks
 */
export function buildContextFromChunks(
  chunks: Array<{ content: string; documentId: string; documentName: string; chunkIndex: number }>
): string {
  return chunks
    .map((chunk, idx) => `[Chunk ${idx + 1}]\n${chunk.content}`)
    .join('\n\n---\n\n');
}

