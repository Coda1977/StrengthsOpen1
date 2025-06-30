import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Navigation from "@/components/Navigation";
import { useCleanup } from "@/hooks/useCleanup";
import { useConversations, useMigration } from "@/hooks/useConversations";
import { LocalStorageManager } from "@/utils/localStorage";
import { useToast } from "@/hooks/use-toast";
import { ErrorBoundary, ChatErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorState, ChatErrorState, NetworkErrorState } from "@/components/ErrorState";
import { useChatRetry } from "@/hooks/useRetry";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";

const isDev = process.env.NODE_ENV === 'development';

// Simple markdown formatter
function formatMarkdown(text: string): string {
  return text
    // Headers
    .replace(/^### (.*$)/gm, '<h3 style="font-size: 1.1em; font-weight: 600; margin: 12px 0 6px 0; color: #1a1a1a;">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 style="font-size: 1.2em; font-weight: 600; margin: 16px 0 8px 0; color: #1a1a1a;">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 style="font-size: 1.3em; font-weight: 600; margin: 20px 0 10px 0; color: #1a1a1a;">$1</h1>')
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 600;">$1</strong>')
    // Italic text
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Numbered lists
    .replace(/^(\d+)\.\s+(.*$)/gm, '<div style="margin: 4px 0; padding-left: 20px;"><strong>$1.</strong> $2</div>')
    // Bullet points
    .replace(/^- (.*$)/gm, '<div style="margin: 4px 0; padding-left: 20px;">• $1</div>')
    // Line breaks
    .replace(/\n/g, '<br>');
}

interface Message {
  id: string;
  content: string;
  type: 'user' | 'ai';
  timestamp: Date;
}

interface ChatHistory {
  id: string;
  title: string;
  messages: Message[];
  lastActivity: Date;
  mode: 'personal' | 'team';
}

const ChatCoach = () => {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [currentMode, setCurrentMode] = useState<'personal' | 'team'>('personal');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [displayedMessages, setDisplayedMessages] = useState<Message[]>([]);
  const [messageLimit, setMessageLimit] = useState(50);
  const [isTyping, setIsTyping] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [migrationInProgress, setMigrationInProgress] = useState(false);
  const [chatError, setChatError] = useState<Error | null>(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    conversationId: string | null;
    conversationTitle: string;
  }>({ show: false, conversationId: null, conversationTitle: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputHeight, setInputHeight] = useState(44);
  const [starterClicked, setStarterClicked] = useState<number | null>(null);

  // Default starter questions as fallback
  const starterQuestions = [
    "How can I better leverage my top strengths as a leader?",
    "What are some ways to develop my team's potential?",
    "How do I handle conflicts based on different strength combinations?"
  ];
  
  // Use cleanup hook for better resource management
  const { createTimeout, addCleanup } = useCleanup();
  
  // Use database-backed conversation management
  const { 
    conversations, 
    isLoading: conversationsLoading,
    createConversation,
    getConversation,
    addMessage,
    updateConversation
  } = useConversations();
  
  const { 
    migrate, 
    isMigrating, 
    recover 
  } = useMigration();
  
  const { toast } = useToast();
  
  // Retry logic for chat operations
  const sendMessageRetry = useChatRetry(async () => {
    if (!message.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      content: message.trim(),
      type: 'user',
      timestamp: new Date()
    };

    setMessages((prev: Message[]) => [...prev, userMessage]);
    setMessage('');
    setIsTyping(true);
    setChatError(null);

    try {
      const response = await fetch('/api/chat-with-coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage.content,
          mode: currentMode,
          conversationHistory: messages.map((msg: Message) => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content
          }))
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.data.response,
        type: 'ai',
        timestamp: new Date()
      };
      
      setMessages((prev: Message[]) => {
        const updatedMessages = [...prev, aiMessage];
        // Auto-save logic here...
        return updatedMessages;
      });
    } finally {
      setIsTyping(false);
    }
  });

  const formatMessageText = (text: string): string => {
    return text
      // Bold text **text** -> <strong>text</strong>
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Bullet points • -> styled bullets (remove original bullet)
      .replace(/^• (.+)/, '<div class="bullet-point">$1</div>')
      // Italic text *text* -> <em>text</em> (but not if it's already processed as bold)
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
      // Handle line breaks
      .replace(/\n/g, '<br/>');
  };

  const modes = [
    { id: 'personal', label: 'My Strengths' },
    { id: 'team', label: 'Team' }
  ];



  // Auto-resize textarea
  const autoResizeTextarea = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, []);

  useEffect(() => {
    autoResizeTextarea();
  }, [message, autoResizeTextarea]);

  // Check for migration needs on component mount
  useEffect(() => {
    checkMigrationNeeds();
  }, []);

  // Handle mobile sidebar behavior
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  // Manage displayed messages for performance
  useEffect(() => {
    if (messages.length <= messageLimit) {
      setDisplayedMessages(messages);
    } else {
      // Show most recent messages
      setDisplayedMessages(messages.slice(-messageLimit));
    }
  }, [messages, messageLimit]);

  // Auto-scroll to bottom when displayed messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayedMessages]);

  // Handle focus when new chat starts
  useEffect(() => {
    if (chatStarted && textareaRef.current && messages.length === 0) {
      textareaRef.current.focus();
    }
  }, [chatStarted, messages.length]);

  const checkMigrationNeeds = async () => {
    // Check migration status
    const migrationStatus = LocalStorageManager.getMigrationStatus();
    if (migrationStatus.success && migrationStatus.data?.completed) {
      return; // Already migrated
    }

    // Check if there's localStorage data to migrate
    const localData = LocalStorageManager.getChatHistory();
    if (localData.success && localData.data && localData.data.length > 0) {
      setMigrationNeeded(true);
      showMigrationPrompt();
    } else if (localData.corrupted) {
      // Handle corrupted data
      handleCorruptedData();
    }
  };

  const showMigrationPrompt = () => {
    toast({
      title: "Chat History Migration",
      description: "We found existing chat history. Would you like to migrate it to the new secure database?",
      duration: 0, // Keep open until dismissed
      action: (
        <div className="flex gap-2">
          <button 
            onClick={performMigration}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
          >
            Migrate
          </button>
          <button 
            onClick={() => {
              LocalStorageManager.setMigrationCompleted();
              setMigrationNeeded(false);
            }}
            className="bg-gray-600 text-white px-3 py-1 rounded text-sm"
          >
            Skip
          </button>
        </div>
      )
    });
  };

  const performMigration = async () => {
    try {
      const localData = LocalStorageManager.getChatHistory();
      if (!localData.success || !localData.data) {
        throw new Error('No data to migrate');
      }

      const result = await migrate(JSON.stringify(localData.data));
      
      toast({
        title: "Migration Successful",
        description: `Migrated ${result.conversationsCreated} conversations and ${result.messagesCreated} messages.`,
      });

      // Clear localStorage and mark migration complete
      LocalStorageManager.clearChatHistory();
      LocalStorageManager.setMigrationCompleted();
      setMigrationNeeded(false);
      
    } catch (error) {
      toast({
        title: "Migration Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  };

  const handleCorruptedData = async () => {
    try {
      const recovered = LocalStorageManager.attemptDataRecovery();
      if (recovered.success && recovered.data && recovered.data.length > 0) {
        // Show recovery option
        toast({
          title: "Corrupted Data Recovery",
          description: `Found ${recovered.data.length} recoverable conversations. Attempt recovery?`,
          action: (
            <button 
              onClick={() => performRecovery(recovered.data ?? [])}
              className="bg-orange-600 text-white px-3 py-1 rounded text-sm"
            >
              Recover
            </button>
          )
        });
      } else {
        // Report corruption
        await recover("");
        toast({
          title: "Data Corruption Detected",
          description: "Previous chat data was corrupted and could not be recovered. A report has been saved.",
          variant: "destructive"
        });
      }
    } catch (error) {
      if (isDev) console.error('Recovery failed:', error);
    }
  };

  const performRecovery = async (recoveredData: any[]) => {
    try {
      const result = await migrate(JSON.stringify(recoveredData));
      toast({
        title: "Recovery Successful",
        description: `Recovered ${result.conversationsCreated} conversations.`,
      });
      
      LocalStorageManager.clearChatHistory();
      LocalStorageManager.setMigrationCompleted();
    } catch (error) {
      if (isDev) console.error('Recovery failed:', error);
      toast({
        title: "Recovery Failed",
        description: "Could not recover the corrupted data.",
        variant: "destructive"
      });
    }
  };

  const generateChatTitle = (firstMessage: string): string => {
    const words = firstMessage.split(' ').slice(0, 6);
    return words.length < firstMessage.split(' ').length 
      ? words.join(' ') + '...' 
      : words.join(' ');
  };

  const saveCurrentChat = async () => {
    if (messages.length === 0) return;

    try {
      if (currentChatId) {
        // Update existing conversation
        await updateConversation({
          id: currentChatId,
          data: {
            title: generateChatTitle(messages.find(m => m.type === 'user')?.content || 'New Chat'),
            mode: currentMode
          }
        });
      } else {
        // Create new conversation
        const conversation = await createConversation({
          title: generateChatTitle(messages.find(m => m.type === 'user')?.content || 'New Chat'),
          mode: currentMode
        });
        setCurrentChatId(conversation.id);

        // Add all messages to the new conversation
        for (const msg of messages) {
          await addMessage({
            conversationId: conversation.id,
            data: {
              content: msg.content,
              type: msg.type
            }
          });
        }
      }
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Could not save the conversation",
        variant: "destructive"
      });
    }
  };

  const loadChat = async (conversationId: string) => {
    try {

      
      const response = await fetch(`/api/conversations/${conversationId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      

      
      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(`Failed to load conversation: ${response.status}`);
      }
      
      const result = await response.json();
      const data = result.data;
      
      if (data && data.conversation && data.messages) {

        
        // Sort messages by timestamp to ensure proper order
        const sortedMessages = data.messages.sort((a: Message, b: Message) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        const loadedMessages = sortedMessages.map((msg: Message) => ({
          id: msg.id,
          content: msg.content,
          type: msg.type as 'user' | 'ai',
          timestamp: new Date(msg.timestamp || Date.now())
        }));
        

        
        setMessages((prev: Message[]) => [...prev, ...loadedMessages]);
        setCurrentMode(data.conversation.mode as 'personal' | 'team');
        setCurrentChatId(conversationId);
        setChatStarted(true); // Mark that chat is active when loading conversation
        
        // Hide sidebar on mobile after loading chat
        if (isMobile) {
          setSidebarOpen(false);
        }
        
        toast({
          title: "Chat Loaded",
          description: `Loaded conversation with ${data.messages.length} messages`,
          duration: 2000
        });
      }
    } catch (error) {
      toast({
        title: "Load Failed",
        description: "Could not load the conversation. Please try refreshing the page.",
        variant: "destructive"
      });
    }
  };

  const startNewChat = async () => {
    try {
      // Save current chat if it exists
      if (messages.length > 0 && currentChatId && currentChatId !== 'new-chat-active') {
        await saveCurrentChat();
      }
      
      // Clear current state
      setMessages([]);
      setMessage('');
      setChatError(null);
      setInputHeight(44);
      setChatStarted(true); // Mark that a new chat has been started
      setCurrentChatId(null); // Reset to null - will be set when first message is sent
      
      // Clear textarea value
      if (textareaRef.current) {
        textareaRef.current.value = '';
      }
      
      // Hide sidebar on mobile after starting new chat
      if (isMobile) {
        setSidebarOpen(false);
      }
      
      // Show notification
      toast({
        title: "New Chat Started",
        description: "You can now start asking questions about your strengths",
        duration: 2000
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start new chat. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: message.trim(),
      type: 'user',
      timestamp: new Date()
    };

    setMessages((prev: Message[]) => [...prev, userMessage]);
    setMessage('');
    setIsTyping(true);

    // Clear textarea
    if (textareaRef.current) {
      textareaRef.current.value = '';
    }

    try {
      console.log('Sending message to AI coach...');
      const response = await fetch('/api/chat-with-coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage.content,
          mode: currentMode,
          conversationHistory: [...messages, userMessage].slice(-10) // Send last 10 messages for context
        }),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API error response:', errorData);
        throw new Error(errorData.error?.message || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('AI response received successfully');
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.data.response,
        type: 'ai',
        timestamp: new Date()
      };
      
      setMessages((prev: Message[]) => {
        const updatedMessages = [...prev, aiMessage];
        
        // Auto-save conversation after AI response
        createTimeout(async () => {
          if (!currentChatId) {
            try {
              const conversation = await createConversation({
                title: generateChatTitle(userMessage.content),
                mode: currentMode
              });
              setCurrentChatId(conversation.id);
              
              // Add both user and AI messages to new conversation
              await addMessage({
                conversationId: conversation.id,
                data: {
                  content: userMessage.content,
                  type: 'user'
                }
              });
              
              await addMessage({
                conversationId: conversation.id,
                data: {
                  content: aiMessage.content,
                  type: 'ai'
                }
              });
            } catch (error) {
              console.error('Failed to save conversation:', error);
            }
          } else {
            // Add both user and AI messages to existing conversation
            try {
              await addMessage({
                conversationId: currentChatId,
                data: {
                  content: userMessage.content,
                  type: 'user'
                }
              });
              
              await addMessage({
                conversationId: currentChatId,
                data: {
                  content: aiMessage.content,
                  type: 'ai'
                }
              });
            } catch (error) {
              console.error('Failed to save message:', error);
            }
          }
        }, 100);
        
        return updatedMessages;
      });
    } catch (error) {
      console.error('Chat error:', error);
      
      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: `ERROR: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        type: 'ai',
        timestamp: new Date()
      };
      
      setMessages((prev: Message[]) => [...prev, errorMessage]);
      
      toast({
        title: "AI Chat Error",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
        action: (
          <button 
            onClick={async () => {
              // Test OpenAI connection
              try {
                const testResponse = await fetch('/api/test-openai', {
                  credentials: 'include'
                });
                const testData = await testResponse.json();
                toast({
                  title: testData.success ? "OpenAI Connection Test" : "OpenAI Connection Failed",
                  description: testData.success ? "OpenAI is working correctly" : testData.error,
                  variant: testData.success ? "default" : "destructive"
                });
              } catch (testError) {
                toast({
                  title: "Connection Test Failed",
                  description: "Could not test OpenAI connection",
                  variant: "destructive"
                });
              }
            }}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
          >
            Test AI
          </button>
        )
      });
    } finally {
      setIsTyping(false);
    }
  };

  // Debounced auto-save function
  const debouncedSave = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (messages.length > 0 && currentChatId) {
          saveCurrentChat();
        }
      }, 1000);
    };
  }, [messages.length, currentChatId]);

  // Auto-save when messages change
  useEffect(() => {
    if (messages.length > 0 && currentChatId) {
      debouncedSave();
    }
  }, [messages, currentChatId, debouncedSave]);

  // Mobile input handling functions
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    autoResizeTextarea();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStarterQuestion = (question: string, idx: number) => {
    setStarterClicked(idx);
    setMessage(question);
    setTimeout(() => {
      handleSendMessage();
      setStarterClicked(null);
    }, 200);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: "Message content copied successfully",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Handle conversation deletion
  const handleDeleteConversation = async (conversationId: string, conversationTitle: string) => {
    setDeleteConfirm({
      show: true,
      conversationId,
      conversationTitle
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.conversationId) return;
    
    try {
      const response = await fetch(`/api/conversations/${deleteConfirm.conversationId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }

      if (currentChatId === deleteConfirm.conversationId) {
        setCurrentChatId(null);
        setMessages([]);
      }

      setDeleteConfirm({ show: false, conversationId: null, conversationTitle: '' });
      window.location.reload();
      
      toast({
        title: "Conversation Deleted",
        description: "The conversation has been permanently removed",
        duration: 2000
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Could not delete the conversation. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Add state for context-aware starter and follow-up questions
  const [contextStarters, setContextStarters] = useState<string[]>([]);
  const [startersLoading, setStartersLoading] = useState(false);
  const [followUps, setFollowUps] = useState<{ [msgId: string]: string[] }>({});
  const [followUpLoading, setFollowUpLoading] = useState<{ [msgId: string]: boolean }>({});

  // Fetch context-aware starter questions on new chat
  const fetchContextStarters = async () => {
    setStartersLoading(true);
    try {
      const res = await fetch('/api/context-starter-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ recentTopics: [] }) // Optionally add recent topics
      });
      const data = await res.json();
      setContextStarters(data.data.questions || []);
    } catch {
      setContextStarters([]);
    }
    setStartersLoading(false);
  };

  // Fetch follow-up questions after each AI answer
  const fetchFollowUps = async (aiMsg: Message, history: Message[]) => {
    setFollowUpLoading(prev => ({ ...prev, [aiMsg.id]: true }));
    try {
      const res = await fetch('/api/followup-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aiAnswer: aiMsg.content, conversationHistory: history })
      });
      const data = await res.json();
      setFollowUps(prev => ({ ...prev, [aiMsg.id]: data.data.questions || [] }));
    } catch {
      setFollowUps(prev => ({ ...prev, [aiMsg.id]: [] }));
    }
    setFollowUpLoading(prev => ({ ...prev, [aiMsg.id]: false }));
  };

  // On new chat, fetch context-aware starters
  useEffect(() => {
    if (chatStarted && messages.length === 0) {
      fetchContextStarters();
    }
  }, [chatStarted, messages.length]);

  // Also fetch starters when the component first loads with no chat
  useEffect(() => {
    if (!chatStarted && messages.length === 0 && !currentChatId) {
      fetchContextStarters();
    }
  }, []);

  // After each AI message, fetch follow-ups
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.type === 'ai' && lastMsg.content && !followUps[lastMsg.id]) {
        fetchFollowUps(lastMsg, messages.slice(0, -1));
      }
    }
  }, [messages]);

  // When a starter or follow-up is clicked, send as message
  const handleContextStarterClick = (q: string) => {
    setMessage(q);
    setTimeout(() => handleSendMessage(), 100);
  };
  const handleFollowUpClick = (q: string) => {
    setMessage(q);
    setTimeout(() => handleSendMessage(), 100);
  };

  return (
    <ErrorBoundary>
      <div className="dashboard" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
        <Navigation />
        <div className="main-container">
          {/* Sidebar Toggle Button */}
          {!sidebarOpen && (
            <button 
              className="sidebar-toggle"
              onClick={toggleSidebar}
              aria-label="Open chat history"
              tabIndex={0}
            >
              ☰
            </button>
          )}

          {/* Mobile Overlay */}
          {isMobile && sidebarOpen && (
            <div 
              className="sidebar-overlay"
              onClick={() => setSidebarOpen(false)}
              tabIndex={0}
              aria-label="Close sidebar"
              role="button"
            />
          )}

          {/* Sidebar */}
          <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
              <div className="mode-toggle">
                {modes.map((mode) => (
                  <button
                    key={mode.id}
                    className={`mode-button ${currentMode === mode.id ? 'active' : ''}`}
                    onClick={() => setCurrentMode(mode.id as 'personal' | 'team')}
                    aria-label={`Switch to ${mode.label} mode`}
                    tabIndex={0}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <button 
                className="new-chat-button"
                onClick={startNewChat}
                aria-label="Start new chat"
                tabIndex={0}
              >
                <span style={{fontSize: '20px'}}>+</span>
                New Chat
              </button>
            </div>

            <div className="chat-history">
              {conversationsLoading ? (
                <>
                  <Skeleton className="skeleton-history" />
                  <Skeleton className="skeleton-history" />
                  <Skeleton className="skeleton-history" />
                </>
              ) : conversations.length === 0 ? (
                <div className="empty-history">
                  <h3>No conversations yet</h3>
                  <p>Start a new chat to begin exploring your strengths with AI guidance.</p>
                  {migrationNeeded && (
                    <div className="migration-notice">
                      <p className="text-sm text-blue-600">Found chat history to migrate</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="history-list">
                  {conversations.map((conversation) => (
                    <div 
                      key={conversation.id}
                      className={`history-item ${currentChatId === conversation.id ? 'active' : ''}`}
                    >
                      <div 
                        className="history-content"
                        onClick={() => loadChat(conversation.id)}
                        tabIndex={0}
                        aria-label={`Load conversation: ${conversation.title}`}
                      >
                        <div className="history-title">{conversation.title}</div>
                        <div className="history-meta">
                          <span className="history-mode">{conversation.mode === 'personal' ? 'My Strengths' : 'Team'}</span>
                          <span className="history-date">
                            {conversation.lastActivity ? new Date(conversation.lastActivity).toLocaleDateString() : 'Unknown'}
                          </span>
                        </div>
                      </div>
                      <button 
                        className="delete-conversation-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConversation(conversation.id, conversation.title);
                        }}
                        title="Delete conversation"
                        aria-label={`Delete conversation: ${conversation.title}`}
                        tabIndex={0}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c0 1 1 2 2 2v2"/>
                          <path d="M10 11v6M14 11v6"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chat Container */}
          <div className="chat-container">
            <div className="chat-header">
              <button 
                className="mobile-sidebar-toggle"
                onClick={toggleSidebar}
                aria-label="Toggle sidebar"
                tabIndex={0}
              >
                ☰
              </button>
              <h1 className="chat-title">
                AI Strengths Coach
              </h1>
            </div>

            <div className="messages-container" role="log" aria-live="polite">
              {messages.length === 0 && !chatStarted ? (
                <div className="welcome-message">
                  <div className="welcome-content">
                    <h2>Welcome to your AI Strengths Coach!</h2>
                    <p>I'm here to help you understand and leverage your CliftonStrengths for better leadership and team dynamics.</p>
                    {startersLoading ? (
                      <>
                        <Skeleton className="skeleton-message" />
                        <Skeleton className="skeleton-message" />
                      </>
                    ) : contextStarters.length > 0 ? (
                      <div className="starter-questions">
                        {contextStarters.map((q, idx) => (
                          <button
                            key={idx}
                            className="starter-question"
                            onClick={() => handleContextStarterClick(q)}
                            aria-label={`Ask: ${q}`}
                            tabIndex={0}
                            disabled={isTyping}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="starter-questions">
                        {starterQuestions.map((question, index) => (
                          <button
                            key={index}
                            className={`starter-question${starterClicked === index ? ' clicked' : ''}`}
                            onClick={() => handleStarterQuestion(question, index)}
                            aria-label={`Ask: ${question}`}
                            tabIndex={0}
                            disabled={isTyping}
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {isTyping && messages.length === 0 && (
                    <>
                      <Skeleton className="skeleton-message" />
                      <Skeleton className="skeleton-message" />
                    </>
                  )}
                  {messages.map((msg: Message, index: number) => {

                    return (
                      <div 
                        key={`${msg.id}-${index}`}
                        className={`message ${msg.type}`}
                        tabIndex={0}
                        aria-label={`${msg.type === 'user' ? 'You' : 'AI'} message: ${msg.content}`}
                      >
                        <div className={`message-avatar ${msg.type}`}
                          aria-label={msg.type === 'user' ? 'User avatar' : 'AI avatar'}
                        >
                          {msg.type === 'user' ? (
                            <span role="img" aria-label="User">🧑</span>
                          ) : (
                            <span role="img" aria-label="AI">🤖</span>
                          )}
                        </div>
                        <div className={`message-content ${msg.type}`}
                          tabIndex={0}
                        >
                          {msg.type === 'user' ? (
                            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                          ) : msg.content.startsWith('ERROR:') ? (
                            <ErrorState
                              type={msg.content.split(':')[1] as any}
                              error={msg.content}
                              onRetry={() => {
                                const lastUserMessage = messages.filter((m: Message) => m.type === 'user').pop();
                                if (lastUserMessage) {
                                  setMessage(lastUserMessage.content);
                                  setTimeout(() => handleSendMessage(), 100);
                                }
                              }}
                            />
                          ) : (
                            <div dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
                          )}
                          <button 
                            className="copy-message-button copy-button"
                            onClick={() => copyToClipboard(msg.content)}
                            title="Copy message"
                            aria-label="Copy message to clipboard"
                            tabIndex={0}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
                              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                            </svg>
                          </button>
                        </div>
                        {msg.type === 'ai' && followUps[msg.id] && followUps[msg.id].length > 0 && (
                          <div className="starter-questions" style={{ marginTop: 8 }}>
                            {followUpLoading[msg.id] ? (
                              <Skeleton className="skeleton-message" />
                            ) : followUps[msg.id].map((q, idx) => (
                              <button
                                key={idx}
                                className="starter-question"
                                onClick={() => handleFollowUpClick(q)}
                                aria-label={`Ask: ${q}`}
                                tabIndex={0}
                                disabled={isTyping}
                                style={{ fontSize: 14, marginBottom: 4 }}
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {isTyping && (
                    <div className="typing-indicator" role="status" aria-live="polite">
                      <div className="message-avatar ai" aria-label="AI avatar">🤖</div>
                      <div className="typing-content">
                        <span className="typing-text">AI is thinking</span>
                        <div className="typing-dots">
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="input-container" style={{ position: 'relative' }}>
              <div className="chat-input-wrapper">
                <textarea
                  ref={textareaRef}
                  className="chat-input"
                  placeholder="Ask about your strengths or team..."
                  value={message}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyPress}
                  rows={1}
                  aria-label="Type your message"
                  disabled={isTyping}
                  tabIndex={0}
                  style={{ resize: 'none', overflow: 'hidden' }}
                />
                <button 
                  className="send-button"
                  onClick={handleSendMessage}
                  disabled={!message.trim() || isTyping}
                  aria-label="Send message"
                  tabIndex={0}
                >
                  {isTyping ? (
                    <div className="send-spinner" aria-label="Sending..." />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                    </svg>
                  )}
                </button>
                {isTyping && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(255,255,255,0.6)',
                    borderRadius: 12,
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }} aria-label="AI is responding" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm.show && (
          <div className="modal active" onClick={() => setDeleteConfirm({ show: false, conversationId: null, conversationTitle: '' })}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Delete Conversation</h3>
              <p>Are you sure you want to delete "{deleteConfirm.conversationTitle}"?</p>
              <p style={{ color: '#dc2626', fontSize: '14px' }}>This action cannot be undone.</p>
              
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button
                  onClick={() => setDeleteConfirm({ show: false, conversationId: null, conversationTitle: '' })}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    color: '#4A4A4A',
                    cursor: 'pointer'
                  }}
                  aria-label="Cancel delete"
                  tabIndex={0}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  style={{
                    padding: '0.75rem 1.5rem',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: '#dc2626',
                    color: '#FFFFFF',
                    cursor: 'pointer'
                  }}
                  aria-label="Confirm delete"
                  tabIndex={0}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default ChatCoach;
