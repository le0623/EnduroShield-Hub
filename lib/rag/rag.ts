import OpenAI from 'openai';
import { retrieveRelevantChunks, buildContextFromChunks } from './retrieval';
import { trackTokenUsage, checkBalance } from '../billing';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface RAGSource {
  documentId: string;
  documentName: string;
  documentUrl: string;
}

export interface RAGResponse {
  answer: string;
  sources: RAGSource[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
}

/**
 * Generate an answer using RAG (Retrieval-Augmented Generation)
 * @param userId Optional: if provided, filters chunks by user's access tags
 * @param skipBalanceCheck Optional: if true, skips balance check (for widget/internal use)
 */
export async function generateRAGAnswer(
  query: string,
  tenantId: string,
  conversationHistory: Array<{ role: 'USER' | 'ASSISTANT'; content: string }> = [],
  userId?: string,
  skipBalanceCheck: boolean = false
): Promise<string> {
  const response = await generateRAGAnswerWithUsage(query, tenantId, conversationHistory, userId, skipBalanceCheck);
  return response.answer;
}

/**
 * Generate an answer using RAG with detailed usage info
 * @param userId Optional: if provided, filters chunks by user's access tags
 * @param skipBalanceCheck Optional: if true, skips balance check (for widget/internal use)
 */
export async function generateRAGAnswerWithUsage(
  query: string,
  tenantId: string,
  conversationHistory: Array<{ role: 'USER' | 'ASSISTANT'; content: string }> = [],
  userId?: string,
  skipBalanceCheck: boolean = false
): Promise<RAGResponse> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    // Check balance before processing (unless skipped)
    if (!skipBalanceCheck) {
      const { hasBalance, balance } = await checkBalance(tenantId);
      if (!hasBalance) {
        throw new Error(`INSUFFICIENT_BALANCE:${balance}`);
      }
    }

    // Retrieve relevant chunks (filtered by user tags if userId provided)
    const relevantChunks = await retrieveRelevantChunks(query, tenantId, 5, userId);

    if (relevantChunks.length === 0) {
      return {
        answer: 'I could not find any relevant information in the knowledge base to answer your question. Please make sure documents have been uploaded and approved.',
        sources: [],
      };
    }

    // Extract unique source documents
    const sourceMap = new Map<string, RAGSource>();
    relevantChunks.forEach((chunk) => {
      if (!sourceMap.has(chunk.documentId)) {
        sourceMap.set(chunk.documentId, {
          documentId: chunk.documentId,
          documentName: chunk.documentName,
          documentUrl: chunk.documentUrl,
        });
      }
    });
    const sources = Array.from(sourceMap.values());

    // Build context from chunks
    const context = buildContextFromChunks(relevantChunks);

    // Build conversation history for context
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are a helpful AI assistant that answers questions based on the provided document context.

FORMATTING RULES:
- Use **Markdown formatting** in your responses for better readability
- Use **bold** for emphasis on important terms
- Use bullet points or numbered lists when listing multiple items
- Use headings (## or ###) for sections if the answer is long
- Use code blocks for any code or technical terms
- Use paragraphs to separate different ideas
        
IMPORTANT RULES:
- Answer questions ONLY using the information provided in the context below
- If the answer cannot be found in the context, clearly state that you don't have that information
- Be concise and accurate
- Do NOT mention chunk numbers or cite specific chunks in your response
- If asked about something not in the context, politely say you don't have that information

Context from knowledge base:
${context}`,
      },
      // Add conversation history (last 10 messages to avoid token limits)
      ...conversationHistory.slice(-10).map((msg) => ({
        role: (msg.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: msg.content,
      })),
      {
        role: 'user',
        content: query,
      },
    ];

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // Generate answer using GPT
    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const answer = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Track token usage if available
    let usageInfo: RAGResponse['usage'];
    if (completion.usage) {
      const { prompt_tokens, completion_tokens, total_tokens } = completion.usage;
      
      const { cost } = await trackTokenUsage(
        tenantId,
        model,
        prompt_tokens,
        completion_tokens,
        'OpenAI'
      );

      usageInfo = {
        promptTokens: prompt_tokens,
        completionTokens: completion_tokens,
        totalTokens: total_tokens,
        cost,
      };
    }

    return { answer, sources, usage: usageInfo };
  } catch (error) {
    console.error('Error generating RAG answer:', error);
    throw error;
  }
}


