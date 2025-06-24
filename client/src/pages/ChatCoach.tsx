import { useState, useEffect, useRef } from "react";
import Navigation from "@/components/Navigation";
import { useCleanup } from "@/hooks/useCleanup";
import { useConversations, useMigration } from "@/hooks/useConversations";
import { LocalStorageManager } from "@/utils/localStorage";
import { useToast } from "@/hooks/use-toast";
import { ErrorBoundary, ChatErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorState, ChatErrorState, NetworkErrorState } from "@/components/ErrorState";
import { useChatRetry } from "@/hooks/useRetry";

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
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [currentMode, setCurrentMode] = useState<'personal' | 'team'>('personal');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [migrationInProgress, setMigrationInProgress] = useState(false);
  const [chatError, setChatError] = useState<Error | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check for migration needs on component mount
  useEffect(() => {
    checkMigrationNeeds();
  }, []);

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
    setMigrationInProgress(true);
    
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
      setMigrationInProgress(false);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
            mode: currentMode,
            lastActivity: new Date()
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
      const conversationQuery = getConversation(conversationId);
      const { data } = await conversationQuery.refetch();
      
      if (data) {
        setMessages(data.messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          type: msg.type as 'user' | 'ai',
          timestamp: msg.timestamp || new Date()
        })));
        setCurrentMode(data.conversation.mode);
        setCurrentChatId(conversationId);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      toast({
        title: "Load Failed",
        description: "Could not load the conversation",
        variant: "destructive"
      });
    }
  };

  const startNewChat = async () => {
    if (messages.length > 0 && currentChatId) {
      await saveCurrentChat();
    }
    setMessages([]);
    setMessage('');
    setCurrentChatId(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
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

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setMessage('');
    setIsTyping(true);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
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
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        type: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Auto-save chat when messages change - using cleanup hook
  useEffect(() => {
    if (messages.length > 0 && currentChatId) {
      createTimeout(() => {
        saveCurrentChat();
      }, 1000); // Save 1 second after last message
    }
  }, [messages, currentChatId, currentMode, createTimeout]);

  const getAIResponse = (userInput: string): string => {
    // Simple response logic based on input
    if (userInput.toLowerCase().includes('strategic')) {
      return "Your Strategic thinking is a powerful asset! Here are some ways to leverage it with your team:\n\n• **Pattern Recognition**: Help your team see connections and implications they might miss\n• **Alternative Planning**: Present multiple pathways to achieve goals\n• **Risk Assessment**: Use your ability to anticipate obstacles to help the team prepare\n\nTry leading a planning session where you guide the team through different scenarios. Your Strategic talent can help everyone think more systematically about challenges and opportunities.";
    }
    
    if (userInput.toLowerCase().includes('empathy')) {
      return "Developing your Empathy theme is about tuning into others' emotions more intentionally:\n\n• **Active Listening**: Practice focusing completely on what others are saying and feeling\n• **Perspective Taking**: Before meetings, consider how different team members might react\n• **Emotional Check-ins**: Start conversations by genuinely asking how someone is doing\n\nRemember, your Empathy is like an emotional radar. The more you practice using it consciously, the stronger it becomes at helping you connect with and understand others.";
    }

    return "That's a great question about leveraging your strengths! Based on your CliftonStrengths profile, I'd recommend:\n\n• **Strengths Partnerships**: Identify team members whose strengths complement yours\n• **Daily Application**: Find small ways to use your top themes in everyday tasks\n• **Development Focus**: Choose one strength to develop more intentionally this month\n\nWhat specific situation are you facing where you'd like to apply your strengths more effectively?";
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const handleStarterQuestion = (question: string) => {
    setMessage(question);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  return (
    <ErrorBoundary>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Navigation />
        
        <div className={`main-container ${sidebarHidden ? 'sidebar-hidden' : ''}`} style={{ flex: 1 }}>
          {/* Floating Hamburger Menu */}
          <button 
            className={`floating-hamburger ${sidebarHidden ? 'visible' : 'hidden'}`}
            onClick={() => setSidebarHidden(false)}
            aria-label="Open chat history"
          >
            <div className="hamburger-line"></div>
            <div className="hamburger-line"></div>
            <div className="hamburger-line"></div>
          </button>

          {/* Edge Swipe Handle */}
          <div 
            className="edge-swipe-handle"
            onClick={() => setSidebarHidden(false)}
          ></div>

          {/* Swipe Overlay */}
          <div 
            className="swipe-overlay"
            onClick={() => setSidebarHidden(true)}
          ></div>

          {/* Sidebar */}
          <div className={`sidebar ${sidebarHidden ? 'hidden' : ''}`}>
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
            >
              <span style={{fontSize: '20px', marginRight: '4px'}}>+</span>
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
              onClick={() => setSidebarHidden(!sidebarHidden)}
            >
              ☰
            </button>
            <h1 className="chat-title">AI Strengths Coach</h1>
          </div>

          <div className="messages-container">
            {messages.length === 0 ? (
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
                {messages.map((msg) => (
                  <div key={msg.id} className={`message ${msg.type}`}>
                    <div className="message-avatar">
                      {msg.type === 'user' ? 'You' : 'AI'}
                    </div>
                    <div className="message-content">
                      {msg.content.split('\n').map((line, index) => (
                        <div key={index} dangerouslySetInnerHTML={{ 
                          __html: formatMessageText(line) 
                        }} />
                      ))}
                      <button 
                        className="copy-button"
                        onClick={() => copyToClipboard(msg.content)}
                        title="Copy message"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                ))}
                
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
                style={{ height: 'auto' }}
              />
              <button 
                className="send-button"
                onClick={handleSendMessage}
                disabled={!message.trim() || isTyping}
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
      </div>
    </ErrorBoundary>
  );
};

export default ChatCoach;
