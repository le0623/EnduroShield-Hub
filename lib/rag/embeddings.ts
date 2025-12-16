import OpenAI from 'openai';
import { prisma } from '../prisma';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dimensions
// Alternative: 'text-embedding-3-large' (3072 dimensions) for better quality

/**
 * Generate embedding for a text chunk
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple text chunks (batch processing)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    // OpenAI supports up to 2048 inputs per request, but we'll batch in smaller chunks
    const batchSize = 100;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      });

      embeddings.push(...response.data.map(item => item.embedding));
    }

    return embeddings;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

/**
 * Store version chunks with embeddings in the database
 */
export async function storeVersionChunks(
  versionId: string,
  chunks: Array<{ text: string; index: number; metadata?: Record<string, unknown> }>,
  embeddings: number[][]
): Promise<void> {
  try {
    // Delete existing chunks for this version (in case of re-processing)
    await prisma.documentChunk.deleteMany({
      where: { versionId },
    });

    // Store chunks with embeddings
    const chunkData = chunks.map((chunk, idx) => ({
      versionId,
      content: chunk.text,
      chunkIndex: chunk.index,
      embedding: embeddings[idx],
      metadata: chunk.metadata ? JSON.stringify(chunk.metadata) : null,
    }));

    // Insert in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < chunkData.length; i += batchSize) {
      const batch = chunkData.slice(i, i + batchSize);
      await prisma.documentChunk.createMany({
        data: batch,
      });
    }

    console.log(`✅ Stored ${chunkData.length} chunks for version ${versionId}`);
  } catch (error) {
    console.error('Error storing version chunks:', error);
    throw error;
  }
}

/**
 * Process and embed a document version
 */
export async function processAndEmbedVersion(
  versionId: string,
  text: string
): Promise<void> {
  try {
    // Import splitter
    const { splitTextByParagraphs } = await import('../utils/splitter');
    
    // Split text into chunks
    const chunks = splitTextByParagraphs(text, 1000, 200);
    
    if (chunks.length === 0) {
      console.warn(`No chunks created for version ${versionId}`);
      return;
    }

    // Generate embeddings for all chunks
    const texts = chunks.map(chunk => chunk.text);
    const embeddings = await generateEmbeddings(texts);

    // Store chunks with embeddings
    await storeVersionChunks(versionId, chunks, embeddings);
  } catch (error) {
    console.error('Error processing and embedding version:', error);
    throw error;
  }
}

/**
 * @deprecated Use processAndEmbedVersion instead
 * Legacy function for backward compatibility
 */
export async function processAndEmbedDocument(
  documentId: string,
  text: string
): Promise<void> {
  console.warn('processAndEmbedDocument is deprecated. Use processAndEmbedVersion instead.');
  // This is a no-op now - documents should use versions
  throw new Error('processAndEmbedDocument is deprecated. Use processAndEmbedVersion with a version ID.');
}
