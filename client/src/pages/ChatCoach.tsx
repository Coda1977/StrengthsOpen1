import { useState, useEffect, useRef } from "react";
import Navigation from "@/components/Navigation";

interface Message {
  id: string;
  content: string;
  type: 'user' | 'ai';
  timestamp: Date;
}

const ChatCoach = () => {
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [currentMode, setCurrentMode] = useState('personal');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
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

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: getAIResponse(userMessage.content),
        type: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

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
            <button className="new-chat-button">
              <span style={{fontSize: '20px', marginRight: '4px'}}>+</span>
              New Chat
            </button>
          </div>

          <div className="chat-history">
            <div className="empty-history">
              <h3>No conversations yet</h3>
              <p>Start a new chat to begin exploring your strengths with AI guidance.</p>
            </div>
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
