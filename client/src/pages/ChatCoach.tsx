import { useState, useEffect, useRef, useMemo } from "react";
import Navigation from "@/components/Navigation";
import { useCleanup } from "@/hooks/useCleanup";
import { useConversations, useMigration } from "@/hooks/useConversations";
import { LocalStorageManager } from "@/utils/localStorage";
import { useToast } from "@/hooks/use-toast";
import { ErrorBoundary, ChatErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorState, ChatErrorState, NetworkErrorState } from "@/components/ErrorState";
import { useChatRetry } from "@/hooks/useRetry";
import { useIsMobile } from "@/hooks/use-mobile";

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

    setMessages(prev => [...prev, userMessage]);
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
          conversationHistory: messages.map(msg => ({
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
      
      setMessages(prev => {
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

  const starterQuestions = [
    "How can I better leverage my top strengths as a manager?",
    "What should I know about managing different strength types?",
    "How do I identify and develop my team's strengths?"
  ];



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
      messagesEndRef.current.scrollIntoViewIfNeeded?.() || 
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
    setUiState('migrating');
    
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
      console.error('Migration failed:', error);
      toast({
        title: "Migration Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setUiState('idle');
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
              onClick={() => performRecovery(recovered.data)}
              className="bg-orange-600 text-white px-3 py-1 rounded text-sm"
            >
              Recover
            </button>
          )
        });
      } else {
        // Report corruption
        await recover();
        toast({
          title: "Data Corruption Detected",
          description: "Previous chat data was corrupted and could not be recovered. A report has been saved.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Recovery failed:', error);
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
      console.error('Recovery failed:', error);
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
      console.error('Failed to save conversation:', error);
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
        console.error('Failed to load conversation:', response.status, errorText);
        throw new Error(`Failed to load conversation: ${response.status}`);
      }
      
      const result = await response.json();
      const data = result.data;
      
      if (data && data.conversation && data.messages) {

        
        // Sort messages by timestamp to ensure proper order
        const sortedMessages = data.messages.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        const loadedMessages = sortedMessages.map(msg => ({
          id: msg.id,
          content: msg.content,
          type: msg.type as 'user' | 'ai',
          timestamp: new Date(msg.timestamp || Date.now())
        }));
        
        console.log('All loaded messages:', loadedMessages.map(m => ({ 
          type: m.type, 
          content: m.content.substring(0, 100),
          timestamp: m.timestamp.toISOString()
        })));
        
        setMessages(loadedMessages);
        setCurrentMode(data.conversation.mode);
        setCurrentChatId(conversationId);
        setChatStarted(true); // Mark that chat is active when loading conversation
        
        // Hide sidebar on mobile after loading chat
        if (isMobile) {
          setSidebarHidden(true);
        }
        
        toast({
          title: "Chat Loaded",
          description: `Loaded conversation with ${data.messages.length} messages`,
          duration: 2000
        });
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      toast({
        title: "Load Failed",
        description: "Could not load the conversation. Please try refreshing the page.",
        variant: "destructive"
      });
    }
  };

  const startNewChat = async () => {
    // Save current chat if it exists
    if (messages.length > 0 && currentChatId) {
      await saveCurrentChat();
    }
    
    // Clear current state
    setMessages([]);
    setMessage('');
    setChatError(null);
    setInputHeight(44);
    setChatStarted(true); // Mark that a new chat has been started
    setCurrentChatId('new-chat-active'); // Set a temporary ID to indicate active chat
    
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
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: message.trim(),
      type: 'user',
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setMessage('');
    setIsTyping(true);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      setInputHeight(44);
    }

    try {
      const response = await fetch('/api/chat-with-coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          mode: currentMode,
          conversationHistory: newMessages.slice(-10) // Send last 10 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.data.response,
        type: 'ai',
        timestamp: new Date()
      };
      
      setMessages(prev => {
        const updatedMessages = [...prev, aiMessage];
        // Auto-save new conversation after AI response
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
              console.error('Failed to create conversation:', error);
            }
          } else {
            // Add AI message to existing conversation
            try {
              await addMessage({
                conversationId: currentChatId,
                data: {
                  content: aiMessage.content,
                  type: 'ai'
                }
              });
            } catch (error) {
              console.error('Failed to add message:', error);
            }
          }
        }, 100);
        return updatedMessages;
      });
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Determine error type for better UX
      const errorType = error instanceof Error && error.message.includes('fetch') 
        ? 'connection' 
        : error instanceof Error && error.message.includes('500')
        ? 'server'
        : 'ai_service';

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `ERROR:${errorType}`,
        type: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
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
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };



  const handleStarterQuestion = (question: string) => {
    setMessage(question);
    // Small delay to ensure message is set before sending
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: "Message content copied successfully",
      });
    } catch (error) {
      console.error('Failed to copy text:', error);
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
      console.error('Failed to delete conversation:', error);
      toast({
        title: "Delete Failed",
        description: "Could not delete the conversation. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <ErrorBoundary>
      <div className="app-container">
        <Navigation />
        
        <div className={`main-container ${sidebarOpen ? 'sidebar-open' : ''}`}>
          {/* Sidebar Toggle Button */}
          {!sidebarOpen && (
            <button 
              className="sidebar-toggle"
              onClick={toggleSidebar}
              aria-label="Open chat history"
            >
              ☰
            </button>
          )}

          {/* Mobile Overlay */}
          {isMobile && sidebarOpen && (
            <div 
              className="sidebar-overlay"
              onClick={() => setSidebarOpen(false)}
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
                    onClick={() => setCurrentMode(mode.id)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <button 
                className="new-chat-button"
                onClick={startNewChat}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--accent-blue)',
                  color: 'var(--white)',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                <span style={{fontSize: '20px'}}>+</span>
                New Chat
              </button>
            </div>

            <div className="chat-history">
              {conversationsLoading ? (
                <div className="empty-history">
                  <h3>Loading conversations...</h3>
                </div>
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
              >
                ☰
              </button>
              <h1 className="chat-title">
                AI Strengths Coach
              </h1>
            </div>

            <div className="messages-container">
              {messages.length === 0 && !chatStarted ? (
                <div className="welcome-message">
                  <div className="welcome-content">
                    <h2>Welcome to your AI Strengths Coach!</h2>
                    <p>I'm here to help you understand and leverage your CliftonStrengths for better leadership and team dynamics.</p>
                    <div className="starter-questions">
                      {starterQuestions.map((question, index) => (
                        <button 
                          key={index}
                          className="starter-question"
                          onClick={() => handleStarterQuestion(question)}
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, index) => {

                    return (
                      <div 
                        key={`${msg.id}-${index}`}
                        className={`message ${msg.type}`}
                      >
                        <div className={`message-avatar ${msg.type}`}>
                          {msg.type === 'user' ? 'You' : 'AI'}
                        </div>
                        <div className={`message-content ${msg.type}`}>
                          {msg.type === 'user' ? (
                            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                          ) : msg.content.startsWith('ERROR:') ? (
                            <ErrorMessage 
                              type={msg.content.split(':')[1] as 'connection' | 'server' | 'ai_service' | 'validation' | 'unknown'}
                              retry={() => {
                                const lastUserMessage = messages.filter(m => m.type === 'user').pop();
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
                            className="copy-message-button"
                            onClick={() => copyToClipboard(msg.content)}
                            title="Copy message"
                            aria-label="Copy message to clipboard"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
                              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  
                  {isTyping && (
                    <div className="typing-indicator">
                      <div className="message-avatar">AI</div>
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
            <div className="input-container">
              <div className="chat-input-wrapper">
                <textarea
                  ref={textareaRef}
                  className="chat-input"
                  placeholder="Ask about your strengths or team..."
                  value={message}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyPress}

                  rows={1}
                />
                <button 
                  className="send-button"
                  onClick={handleSendMessage}
                  disabled={!message.trim() || uiState === 'typing'}
                >
                  {isTyping ? (
                    <div className="send-spinner"></div>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                    </svg>
                  )}
                </button>
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
