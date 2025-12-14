"use client";

import { Button } from '@/components/ui/button';
import { PlusIcon, Trash2, ThumbsUp, ThumbsDown, Copy, Check, FileText } from 'lucide-react';
import Image from 'next/image';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
}

interface MessageSource {
  documentId: string;
  documentName: string;
  documentUrl: string;
}

interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  sources?: MessageSource[] | null;
  feedback?: 'POSITIVE' | 'NEGATIVE' | null;
  createdAt: string;
}

export default function AiPowerChat() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  // Check permission - admins should not access this page
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const response = await fetch('/api/user/membership');
        if (response.ok) {
          const data = await response.json();
          if (data.isAdmin) {
            router.push('/dashboard');
            return;
          }
        }
      } catch (error) {
        console.error('Failed to check permission:', error);
      } finally {
        setIsCheckingPermission(false);
      }
    };

    checkPermission();
  }, [router]);

  // Fetch conversations on mount
  useEffect(() => {
    if (!isCheckingPermission) {
      fetchConversations();
    }
  }, [isCheckingPermission]);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      fetchMessages(currentConversationId);
    } else {
      setMessages([]);
    }
  }, [currentConversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      setIsLoadingConversations(true);
      const response = await fetch('/api/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load conversations');
      }
    } catch (err) {
      setError('An error occurred while loading conversations');
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/conversations/${conversationId}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load messages');
      }
    } catch (err) {
      setError('An error occurred while loading messages');
    } finally {
      setIsLoading(false);
    }
  };

  const createNewConversation = async () => {
    try {
      setIsSending(true);
      setError('');
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'New Conversation' }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentConversationId(data.conversation.id);
        setMessages([]);
        await fetchConversations();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create conversation');
        if (errorData.error?.includes('No knowledge base initialized')) {
          // Show this error prominently
        }
      }
    } catch (err) {
      setError('An error occurred while creating conversation');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;

    const messageContent = inputValue.trim();
    setInputValue('');
    setError('');

    // If no conversation exists, create one first
    let conversationId = currentConversationId;
    if (!conversationId) {
      try {
        setIsSending(true);
        const createResponse = await fetch('/api/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: messageContent.substring(0, 50) }),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          setError(errorData.error || 'Failed to create conversation');
          setIsSending(false);
          return;
        }

        const createData = await createResponse.json();
        conversationId = createData.conversation.id;
        setCurrentConversationId(conversationId);
        await fetchConversations();
      } catch (err) {
        setError('An error occurred while creating conversation');
        setIsSending(false);
        return;
      }
    }

    // Add user message to UI immediately
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'USER',
      content: messageContent,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Send message to API
    try {
      setIsSending(true);
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: messageContent }),
      });

      if (response.ok) {
        const data = await response.json();
        // Remove temp message and add real messages
        setMessages((prev) => {
          const filtered = prev.filter((msg) => !msg.id.startsWith('temp-'));
          return [
            ...filtered,
            data.userMessage,
            data.assistantMessage,
          ];
        });
        await fetchConversations(); // Refresh conversations to update title if needed
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to send message');
        // Remove temp message on error
        setMessages((prev) => prev.filter((msg) => !msg.id.startsWith('temp-')));
      }
    } catch (err) {
      setError('An error occurred while sending message');
      // Remove temp message on error
      setMessages((prev) => prev.filter((msg) => !msg.id.startsWith('temp-')));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const selectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
  };

  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the conversation
    if (deletingConversationId) return;

    try {
      setDeletingConversationId(conversationId);
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // If deleting the current conversation, clear it
        if (currentConversationId === conversationId) {
          setCurrentConversationId(null);
          setMessages([]);
        }
        // Refresh conversations list
        await fetchConversations();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete conversation');
      }
    } catch (err) {
      setError('An error occurred while deleting conversation');
    } finally {
      setDeletingConversationId(null);
    }
  };

  const handleFeedback = async (messageId: string, feedback: 'POSITIVE' | 'NEGATIVE') => {
    // Optimistically update the UI
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId) {
          // Toggle off if clicking the same feedback
          const newFeedback = msg.feedback === feedback ? null : feedback;
          return { ...msg, feedback: newFeedback };
        }
        return msg;
      })
    );

    try {
      const message = messages.find((m) => m.id === messageId);
      const newFeedback = message?.feedback === feedback ? null : feedback;

      await fetch(`/api/messages/${messageId}/feedback`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feedback: newFeedback }),
      });
    } catch (err) {
      // Revert on error
      setError('Failed to save feedback');
    }
  };

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  if (isCheckingPermission) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="grid lg:grid-cols-3 grid-cols-1 gap-y-6 lg:gap-x-6 flex-1 min-h-0">
        {/* Conversations Sidebar */}
        <div className="col-span-1 flex flex-col min-h-[400px]">
          <div className="rounded-xl border light-border bg-white flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-4 rounded-t-xl bg-gray-50 flex flex-wrap justify-between items-start gap-3 flex-shrink-0">
              <div className="flex-1">
                <h3 className="xl:text-3xl lg:text-2xl md:text-xl text-xl font-extrabold leading-[1.2]">
                  Conversations
                </h3>
                <p className="font-medium text-gray-500">Previous chat history</p>
              </div>
              <Button
                onClick={createNewConversation}
                disabled={isSending}
                className="btn btn-secondary !inline-flex gap-1 !justify-start text-nowrap"
              >
                <PlusIcon
                  className="size-4"
                />
                New Chat
              </Button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto min-h-0">
              {isLoadingConversations ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin"></div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  No conversations yet. Start a new chat to begin.
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => selectConversation(conv.id)}
                      className={`group flex flex-col items-start gap-2 py-3 cursor-pointer hover:bg-gray-50 px-2 transition-colors relative ${currentConversationId === conv.id ? 'bg-gray-100' : ''
                        }`}
                    >
                      <div className="flex items-start justify-between w-full gap-2">
                        <h4 className="text-base font-semibold text-wrap break-all flex-1">
                          {conv.title}{" "}
                          {conv.messageCount > 0 && (
                            <span className="size-5 text-xs text-white inline-flex justify-center items-center rounded-full bg-primary-500">
                              {conv.messageCount}
                            </span>
                          )}
                        </h4>
                        <button
                          onClick={(e) => deleteConversation(conv.id, e)}
                          disabled={deletingConversationId === conv.id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-500 flex-shrink-0"
                          title="Delete conversation"
                        >
                          {deletingConversationId === conv.id ? (
                            <div className="w-4 h-4 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin"></div>
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      {conv.preview && (
                        <p className="text-sm font-semibold text-wrap break-all text-gray-500 line-clamp-2">
                          {conv.preview}
                        </p>
                      )}
                      <span className="px-3 py-0.5 text-xs font-semibold rounded-full border border-gray-200 bg-gray-50">
                        {formatDate(conv.updatedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Knowledge Chat */}
        <div className="col-span-2 flex flex-col min-h-[400px]">
          <div className="rounded-xl border light-border bg-white p-4 flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex flex-wrap justify-between items-start gap-3 mb-4 flex-shrink-0">
              <div className="flex-1">
                <h3 className="xl:text-3xl lg:text-2xl md:text-xl text-xl font-extrabold leading-[1.2]">
                  Knowledge Chat
                </h3>
                <p className="font-medium text-gray-500">
                  Ask questions about your documents and get AI-powered answers
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex-shrink-0">
                {error}
              </div>
            )}

            {/* Messages Area */}
            <div
              ref={chatAreaRef}
              className="flex-1 overflow-y-auto mb-4 space-y-4 min-h-0"
            >
              {isLoading && messages.length === 0 ? (
                <div className="flex justify-center items-center h-full">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <div className="relative w-full max-w-md">
                    <div className="rounded-xl absolute inset-0 bg-[#f0f0f0] overflow-hidden">
                      <div className="w-[27vw] h-[11vw] rounded-[50%] bg-[#A899F9] blur-[100px] absolute top-0 right-[1vw] rotate-[37deg]"></div>
                      <div className="w-[20vw] h-[15vw] rounded-[50%] bg-[#FEDCB6] blur-[130px] absolute top-[6vw] right-[5vw] rotate-[50deg]"></div>
                      <div className="w-[7vw] h-[11vw] rounded-[50%] bg-[#A899F9] blur-[70px] absolute top-[10vw] left-[15vw] -rotate-[37deg]"></div>
                    </div>
                    <div className="text-center rounded-xl p-4 relative">
                      <Image
                        src="/images/ai-mob.png"
                        alt=""
                        className="max-w-full inline-block"
                        width={400}
                        height={300}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-center space-y-2">
                    <h4 className="text-base font-semibold">Start a conversation</h4>
                    <p className="text-sm text-gray-500 text-center">
                      Ask questions about your documents and I'll help you find the answers.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'USER' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="max-w-[80%] group">
                      <div
                        className={`rounded-lg px-4 py-2 ${message.role === 'USER'
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-900'
                          }`}
                      >
                        {message.role === 'USER' ? (
                          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                        ) : (
                          <div className="prose prose-sm max-w-none prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-code:bg-gray-200 prose-code:px-1 prose-code:rounded prose-pre:bg-gray-800 prose-pre:text-gray-100">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>

                      {/* Source documents - only for assistant messages */}
                      {message.role === 'ASSISTANT' && message.sources && message.sources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="text-xs text-gray-500">Sources:</span>
                          {message.sources.map((source, idx) => (
                            <a
                              key={idx}
                              href={source.documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full hover:bg-blue-100 transition-colors"
                              title={source.documentName}
                            >
                              <FileText className="w-3 h-3" />
                              <span className="max-w-[150px] truncate">{source.documentName}</span>
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className={`flex items-center gap-1 mt-1 ${message.role === 'USER' ? 'justify-end' : 'justify-start'}`}>
                        {/* Copy button - for all messages */}
                        <button
                          onClick={() => copyToClipboard(message.content, message.id)}
                          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedMessageId === message.id ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Feedback buttons - only for assistant messages */}
                        {message.role === 'ASSISTANT' && !message.id.startsWith('temp-') && (
                          <>
                            <button
                              onClick={() => handleFeedback(message.id, 'POSITIVE')}
                              className={`p-1 rounded transition-colors ${message.feedback === 'POSITIVE'
                                  ? 'bg-green-100 text-green-600'
                                  : 'hover:bg-gray-200 text-gray-400 hover:text-gray-600'
                                }`}
                              title="Good response"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleFeedback(message.id, 'NEGATIVE')}
                              className={`p-1 rounded transition-colors ${message.feedback === 'NEGATIVE'
                                  ? 'bg-red-100 text-red-600'
                                  : 'hover:bg-gray-200 text-gray-400 hover:text-gray-600'
                                }`}
                              title="Bad response"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {isSending && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="space-y-3 pt-2 flex-shrink-0">
              <div className="flex items-center light-dark-icon relative">
                <input
                  type="text"
                  placeholder="Ask question about your documents"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  disabled={isSending}
                  className="form-control !pr-10 !bg-transparent border border-gray-200 rounded-lg px-4 py-3 flex-1"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isSending || !inputValue.trim()}
                  className="btn btn-primary size-9 !p-0 flex-none !flex justify-center items-center !rounded-md absolute right-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&_img]:icon-white"
                >
                  <Image
                    src="/images/icons/send.svg"
                    alt="Send"
                    className="icon-img w-5 h-5"
                    width={16}
                    height={16}
                  />
                </button>
              </div>

              <p className="text-xs font-medium text-gray-400">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
