import OpenAI from 'openai';
import { prisma } from './prisma';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Upload a document file to OpenAI and return the file ID
 */
async function uploadDocumentToOpenAI(fileUrl: string, fileName: string): Promise<string | null> {
  try {
    // Fetch the file from the URL
    const response = await fetch(fileUrl);
    if (!response.ok) {
      console.error(`Failed to fetch file from ${fileUrl}: ${response.statusText}`);
      return null;
    }

    const fileBuffer = await response.arrayBuffer();
    const file = new File([fileBuffer], fileName, {
      type: response.headers.get('content-type') || 'application/octet-stream',
    });

    // Upload to OpenAI
    const openaiFile = await openai.files.create({
      file: file,
      purpose: 'assistants',
    });

    return openaiFile.id;
  } catch (error) {
    console.error('Error uploading document to OpenAI:', error);
    return null;
  }
}

/**
 * Create or update an OpenAI Assistant for a tenant with approved documents
 */
export async function createOrUpdateTenantAssistant(tenantId: string): Promise<string | null> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return null;
    }

    // Get tenant with existing assistant ID
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        documents: {
          where: {
            versions: {
              some: {
                status: 'APPROVED',
              },
            },
            activeVersionId: { not: null },
          },
          include: {
            activeVersion: {
              select: {
                fileUrl: true,
                originalName: true,
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      console.error(`Tenant ${tenantId} not found`);
      return null;
    }

    // Get all approved documents with active versions
    const approvedDocuments = tenant.documents.filter(doc => doc.activeVersion);

    if (approvedDocuments.length === 0) {
      // If no approved documents and assistant exists, delete it
      const existingAssistantId = (tenant as any).assistantId;
      if (existingAssistantId) {
        try {
          await openai.beta.assistants.delete(existingAssistantId);
        } catch (error) {
          console.error('Error deleting assistant:', error);
        }
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { assistantId: null } as any,
        });
      }
      return null;
    }

    // Upload all approved documents to OpenAI
    const fileIds: string[] = [];
    for (const doc of approvedDocuments) {
      if (doc.activeVersion) {
        const fileId = await uploadDocumentToOpenAI(doc.activeVersion.fileUrl, doc.activeVersion.originalName);
        if (fileId) {
          fileIds.push(fileId);
        }
      }
    }

    if (fileIds.length === 0) {
      console.error('No documents were successfully uploaded to OpenAI');
      return null;
    }

    // Create or update assistant
    const assistantName = `Knowledge Base Assistant - ${tenant.name}`;
    const instructions = `You are an AI assistant helping users find information from their knowledge base.
You have access to approved documents that have been uploaded and approved by administrators.
Please answer questions based on the information available in these documents.
If the answer cannot be found in the documents, please say so clearly.`;

    let assistantId: string;

    const existingAssistantId = (tenant as any).assistantId;
    if (existingAssistantId) {
      // Update existing assistant
      try {
        const assistant = await openai.beta.assistants.update(existingAssistantId, {
          name: assistantName,
          instructions,
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          tools: [{ type: 'file_search' }],
          tool_resources: {
            file_search: {
              vector_store_ids: [],
            },
          },
        });

        // Create a vector store for the files
        const vectorStore = await openai.beta.assistants.create({
          name: `Vector Store - ${tenant.name}`,
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          tool_resources: {
            file_search: {
              vector_store_ids: fileIds,
            },
          },
        });

        assistantId = assistant.id;
      } catch (error: any) {
        // If assistant doesn't exist, create a new one
        if (error.status === 404) {
          const assistant = await openai.beta.assistants.create({
            name: assistantName,
            instructions,
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            tools: [{ type: 'file_search' }],
            tool_resources: {
              file_search: {
                vector_store_ids: [],
              },
            },
          });

          // Create a vector store for the files
          const vectorStore = await openai.beta.assistants.create({
            name: `Vector Store - ${tenant.name}`,
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            tool_resources: {
              file_search: {
                vector_store_ids: fileIds,
              },
            },
          });

          // Update assistant with vector store
          await openai.beta.assistants.update(assistant.id, {
            tool_resources: {
              file_search: {
                vector_store_ids: [vectorStore.id],
              },
            },
          });

          assistantId = assistant.id;
        } else {
          throw error;
        }
      }
    } else {
      // Create new assistant
      const assistant = await openai.beta.assistants.create({
        name: assistantName,
        instructions,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        tools: [{ type: 'file_search' }],
        tool_resources: {
          file_search: {
            vector_store_ids: [],
          },
        },
      });

      // Create a vector store for the files
      const vectorStore = await openai.beta.assistants.create({
        name: `Vector Store - ${tenant.name}`,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        tool_resources: {
          file_search: {
            vector_store_ids: fileIds,
          },
        },
      });

      assistantId = assistant.id;
    }

    // Save assistant ID to tenant
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { assistantId } as any,
    });

    return assistantId;
  } catch (error) {
    console.error('Error creating/updating tenant assistant:', error);
    return null;
  }
}

/**
 * Get or create a thread for a conversation
 */
export async function getOrCreateThread(conversationId: string): Promise<string | null> {
  try {
    // Check if we should store thread ID in conversation model
    // For now, we'll create a new thread each time or store it in a cache
    // This is a simplified version - you might want to store threadId in the Conversation model
    return null; // Will create new thread each time
  } catch (error) {
    console.error('Error getting/creating thread:', error);
    return null;
  }
}

