import { useState, useEffect, useRef } from "react";
import Navigation from "@/components/Navigation";

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
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Load chat history from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('chat-history');
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory).map((chat: any) => ({
          ...chat,
          lastActivity: new Date(chat.lastActivity),
          messages: chat.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        setChatHistory(parsedHistory);
      } catch (error) {
        console.error('Failed to parse chat history:', error);
      }
    }
  }, []);

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem('chat-history', JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const generateChatTitle = (firstMessage: string): string => {
    const words = firstMessage.split(' ').slice(0, 6);
    return words.length < firstMessage.split(' ').length 
      ? words.join(' ') + '...' 
      : words.join(' ');
  };

  const saveCurrentChat = () => {
    if (messages.length === 0) return;

    const chatToSave: ChatHistory = {
      id: currentChatId || Date.now().toString(),
      title: generateChatTitle(messages.find(m => m.type === 'user')?.content || 'New Chat'),
      messages: [...messages],
      lastActivity: new Date(),
      mode: currentMode
    };

    setChatHistory(prev => {
      const existingIndex = prev.findIndex(chat => chat.id === chatToSave.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = chatToSave;
        return updated.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      } else {
        return [chatToSave, ...prev].sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      }
    });
  };

  const loadChat = (chatId: string) => {
    const chat = chatHistory.find(c => c.id === chatId);
    if (chat) {
      setMessages(chat.messages);
      setCurrentMode(chat.mode);
      setCurrentChatId(chatId);
    }
  };

  const startNewChat = () => {
    if (messages.length > 0) {
      saveCurrentChat();
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
        // Auto-save chat after AI response
        setTimeout(() => {
          if (!currentChatId) {
            setCurrentChatId(Date.now().toString());
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

  // Auto-save chat when messages change
  useEffect(() => {
    if (messages.length > 0 && currentChatId) {
      const timeoutId = setTimeout(() => {
        saveCurrentChat();
      }, 1000); // Save 1 second after last message
      return () => clearTimeout(timeoutId);
    }
  }, [messages, currentChatId, currentMode, chatHistory]);

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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Navigation />
      
      <div className={`main-container ${sidebarHidden ? 'sidebar-hidden' : ''}`}>
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
            {chatHistory.length === 0 ? (
              <div className="empty-history">
                <h3>No conversations yet</h3>
                <p>Start a new chat to begin exploring your strengths with AI guidance.</p>
              </div>
            ) : (
              <div className="history-list">
                {chatHistory.map((chat) => (
                  <div 
                    key={chat.id}
                    className={`history-item ${currentChatId === chat.id ? 'active' : ''}`}
                    onClick={() => loadChat(chat.id)}
                  >
                    <div className="history-title">{chat.title}</div>
                    <div className="history-meta">
                      <span className="history-mode">{chat.mode === 'personal' ? 'My Strengths' : 'Team'}</span>
                      <span className="history-date">
                        {chat.lastActivity.toLocaleDateString()}
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
  );
};

export default ChatCoach;
