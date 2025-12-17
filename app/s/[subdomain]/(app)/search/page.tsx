"use client";

import { Button } from '@/components/ui/button';
import { PlusIcon, Trash2, ThumbsUp, ThumbsDown, Copy, Check, FileText, BookOpen, Search, Sparkles, TrendingUp, Hash } from 'lucide-react';
import Image from 'next/image';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Mode = 'kb' | 'ai';

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

interface Keyword {
  term: string;
  count: number;
  documents: string[];
}

interface KeyPoint {
  text: string;
  documentId: string;
  documentName: string;
}

interface PopularArticle {
  id: string;
  title: string;
  description: string | null;
  categories: Array<{ id: string; name: string }>;
  fileUrl: string | null;
  fileName: string | null;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
  count: number;
}

export default function KnowledgeBaseAndAI() {
  const router = useRouter();
  const params = useParams();
  const [mode, setMode] = useState<Mode>('kb');
  
  // AI Chat state
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

  // KB Browse state
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [keyPoints, setKeyPoints] = useState<KeyPoint[]>([]);
  const [popularArticles, setPopularArticles] = useState<PopularArticle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingKB, setIsLoadingKB] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

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

  // Fetch KB data when in KB mode
  useEffect(() => {
    if (mode === 'kb' && !isCheckingPermission) {
      fetchKBData();
    }
  }, [mode, isCheckingPermission]);

  // Fetch conversations when in AI mode
  useEffect(() => {
    if (mode === 'ai' && !isCheckingPermission) {
      fetchConversations();
    }
  }, [mode, isCheckingPermission]);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (currentConversationId && mode === 'ai') {
      fetchMessages(currentConversationId);
    } else {
      setMessages([]);
    }
  }, [currentConversationId, mode]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (mode === 'ai') {
      scrollToBottom();
    }
  }, [messages, mode]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchKBData = async () => {
    try {
      setIsLoadingKB(true);
      const response = await fetch('/api/knowledge-base/explore');
      if (response.ok) {
        const data = await response.json();
        setKeywords(data.keywords || []);
        setKeyPoints(data.keyPoints || []);
        setPopularArticles(data.popularArticles || []);
        setCategories(data.categories || []);
      } else {
        setError('Failed to load knowledge base data');
      }
    } catch (err) {
      setError('An error occurred while loading knowledge base data');
    } finally {
      setIsLoadingKB(false);
    }
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
      }
    } catch (err) {
      setError('An error occurred while creating conversation');
    } finally {
      setIsSending(false);
    }
  };

  const selectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;

    let conversationId = currentConversationId;
    
    if (!conversationId) {
      // Create new conversation first
      try {
        setIsSending(true);
        const createResponse = await fetch('/api/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: 'New Conversation' }),
        });

        if (createResponse.ok) {
          const createData = await createResponse.json();
          conversationId = createData.conversation.id;
          setCurrentConversationId(conversationId);
          await fetchConversations();
        } else {
          setError('Failed to create conversation');
          return;
        }
      } catch (err) {
        setError('An error occurred while creating conversation');
        return;
      }
    }

    const messageContent = inputValue.trim();
    setInputValue('');
    setIsSending(true);
    setError('');

    // Add user message to UI immediately
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'USER',
      content: messageContent,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: messageContent }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Remove temp message and add real messages
        setMessages((prev) => {
          const filtered = prev.filter((m) => !m.id.startsWith('temp-'));
          return [
            ...filtered,
            {
              ...data.userMessage,
              createdAt: new Date(data.userMessage.createdAt).toISOString(),
            },
            {
              ...data.assistantMessage,
              createdAt: new Date(data.assistantMessage.createdAt).toISOString(),
            },
          ];
        });
        await fetchConversations();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to send message');
        // Remove temp message on error
        setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
      }
    } catch (err) {
      setError('An error occurred while sending message');
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeywordClick = (keyword: string) => {
    setSelectedKeyword(keyword);
    setMode('ai');
    setInputValue(keyword);
    // Auto-send if there's a conversation
    if (currentConversationId || conversations.length > 0) {
      setTimeout(() => {
        handleSendMessage();
      }, 100);
    }
  };

  const handleKeyPointClick = (keyPoint: KeyPoint) => {
    setMode('ai');
    setInputValue(`Tell me more about: ${keyPoint.text.substring(0, 100)}`);
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
      {/* Mode Toggle */}
      <div className="mb-6">
        <div className="inline-flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setMode('kb')}
            className={`px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
              mode === 'kb'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Browse Knowledge Base
          </button>
          <button
            onClick={() => setMode('ai')}
            className={`px-6 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
              mode === 'ai'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Ask AI
          </button>
        </div>
      </div>

      {mode === 'kb' ? (
        /* Knowledge Base Browse Mode */
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          {isLoadingKB ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Search Bar */}
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        setMode('ai');
                        setInputValue(searchQuery);
                      }
                    }}
                    placeholder="Search or ask a question..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-lg"
                  />
                </div>
              </div>

              {/* Keywords Section */}
              {keywords.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Hash className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-bold">Popular Keywords</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((keyword, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleKeywordClick(keyword.term)}
                        className="px-4 py-2 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors text-sm font-medium"
                      >
                        {keyword.term} ({keyword.documents.length})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Points Section */}
              {keyPoints.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-bold">Key Points</h2>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {keyPoints.map((kp, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleKeyPointClick(kp)}
                        className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                      >
                        <p className="text-sm text-gray-700 mb-2 line-clamp-3">{kp.text}</p>
                        <p className="text-xs text-gray-500">From: {kp.documentName}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Articles */}
              {popularArticles.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold mb-4">Popular Articles</h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {popularArticles.map((article) => (
                      <Link
                        key={article.id}
                        href={`/knowledge-base/${article.id}`}
                        className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                      >
                        <h3 className="font-semibold mb-2 line-clamp-2">{article.title}</h3>
                        {article.description && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {article.description}
                          </p>
                        )}
                        {article.categories.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {article.categories.slice(0, 2).map((cat) => (
                              <span
                                key={cat.id}
                                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                              >
                                {cat.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-500">
                          Updated {new Date(article.updatedAt).toLocaleDateString()}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Categories */}
              {categories.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold mb-4">Browse by Category</h2>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <Link
                        key={cat.id}
                        href={`/knowledge-base?category=${encodeURIComponent(cat.name)}`}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        {cat.name} ({cat.count})
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {keywords.length === 0 && keyPoints.length === 0 && popularArticles.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No knowledge base content yet</h3>
                  <p className="text-gray-600">
                    Approved documents will appear here with keywords and key points
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* AI Chat Mode */
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
                  <PlusIcon className="size-4" />
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
                        className={`group flex flex-col items-start gap-2 py-3 cursor-pointer hover:bg-gray-50 px-2 transition-colors relative ${
                          currentConversationId === conv.id ? 'bg-gray-100' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between w-full gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm truncate">{conv.title}</h4>
                            <p className="text-xs text-gray-500 truncate mt-1">{conv.preview}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(conv.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(conv.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="col-span-2 flex flex-col min-h-[400px]">
            <div className="rounded-xl border light-border bg-white flex flex-col flex-1 min-h-0 overflow-hidden">
              <div
                ref={chatAreaRef}
                className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0"
              >
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Sparkles className="w-16 h-16 text-primary mb-4" />
                    <h3 className="text-2xl font-bold mb-2">Ask AI</h3>
                    <p className="text-gray-600 mb-6">
                      Ask questions about your documents and get AI-powered answers
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center max-w-md">
                      {keywords.slice(0, 6).map((kw, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setInputValue(kw.term);
                            handleSendMessage();
                          }}
                          className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm hover:bg-primary/20"
                        >
                          {kw.term}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-4 ${
                        message.role === 'USER' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.role === 'ASSISTANT' && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          message.role === 'USER'
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {message.role === 'ASSISTANT' ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                          >
                            {message.content}
                          </ReactMarkdown>
                        ) : (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        )}
                        {message.sources && Array.isArray(message.sources) && message.sources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-300">
                            <p className="text-xs font-semibold mb-2">Sources:</p>
                            <div className="flex flex-wrap gap-2">
                              {message.sources.map((source, idx) => (
                                <Link
                                  key={idx}
                                  href={`/knowledge-base/${source.documentId}`}
                                  className="text-xs bg-white/50 px-2 py-1 rounded hover:bg-white/80"
                                >
                                  {source.documentName}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          {message.role === 'ASSISTANT' && (
                            <>
                              <button
                                onClick={() => handleFeedback(message.id, 'POSITIVE')}
                                className={`p-1 rounded ${
                                  message.feedback === 'POSITIVE'
                                    ? 'bg-green-100 text-green-700'
                                    : 'hover:bg-gray-200'
                                }`}
                              >
                                <ThumbsUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleFeedback(message.id, 'NEGATIVE')}
                                className={`p-1 rounded ${
                                  message.feedback === 'NEGATIVE'
                                    ? 'bg-red-100 text-red-700'
                                    : 'hover:bg-gray-200'
                                }`}
                              >
                                <ThumbsDown className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => copyToClipboard(message.content, message.id)}
                                className="p-1 rounded hover:bg-gray-200"
                              >
                                {copiedMessageId === message.id ? (
                                  <Check className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {message.role === 'USER' && (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-sm font-semibold">U</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
                {isSending && (
                  <div className="flex gap-4 justify-start">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <div className="bg-gray-100 rounded-lg p-4">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask a question..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isSending}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isSending}
                    className="btn btn-primary"
                  >
                    Send
                  </Button>
                </div>
                {error && (
                  <div className="mt-2 text-sm text-red-600">{error}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    try {
      setDeletingConversationId(conversationId);
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        if (currentConversationId === conversationId) {
          setCurrentConversationId(null);
          setMessages([]);
        }
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
    try {
      const currentFeedback = messages.find((m) => m.id === messageId)?.feedback;
      const newFeedback = currentFeedback === feedback ? null : feedback;

      await fetch(`/api/messages/${messageId}/feedback`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feedback: newFeedback }),
      });

      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, feedback: newFeedback } : msg))
      );
    } catch (err) {
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
}
