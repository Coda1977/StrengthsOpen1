import { useState } from "react";
import Navigation from "@/components/Navigation";

const ChatCoach = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentMode, setCurrentMode] = useState('explore');
  const [message, setMessage] = useState('');

  const modes = [
    { id: 'explore', label: 'Explore' },
    { id: 'develop', label: 'Develop' }
  ];

  const handleSendMessage = () => {
    if (message.trim()) {
      // TODO: Implement message sending logic
      console.log('Sending message:', message);
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStarterQuestion = (question: string) => {
    setMessage(question);
  };

  return (
    <>
      <Navigation />
      <div className="app-content">
        <div className="chat-layout">
          {/* Sidebar */}
          <div className={`chat-sidebar ${!sidebarOpen ? 'hidden' : ''}`}>
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
                <span>+</span>
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

          {/* Main Chat Area */}
          <div className="chat-container">
            <div className="chat-header">
              <h2 className="chat-title">AI Strengths Coach</h2>
              <button 
                className="mobile-sidebar-toggle"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{ display: 'none' }}
              >
                ☰
              </button>
            </div>

            <div className="messages-container">
              <div className="welcome-message">
                <div className="welcome-content">
                  <h2>Welcome to your AI Strengths Coach!</h2>
                  <p>I'm here to help you explore and develop your CliftonStrengths. You can ask me about specific strengths, team dynamics, or development strategies.</p>
                  <div className="starter-questions">
                    <button 
                      className="starter-question"
                      onClick={() => handleStarterQuestion("How can I better leverage my top 5 strengths?")}
                    >
                      How can I better leverage my top 5 strengths?
                    </button>
                    <button 
                      className="starter-question"
                      onClick={() => handleStarterQuestion("What are some ways to develop my weaker themes?")}
                    >
                      What are some ways to develop my weaker themes?
                    </button>
                    <button 
                      className="starter-question"
                      onClick={() => handleStarterQuestion("How do my strengths complement my team?")}
                    >
                      How do my strengths complement my team?
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Input Area */}
            <div className="input-container">
              <div className="chat-input-wrapper">
                <textarea
                  className="chat-input"
                  placeholder="Ask me about your strengths..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  rows={1}
                />
                <button 
                  className="send-button"
                  onClick={handleSendMessage}
                  disabled={!message.trim()}
                >
                  ↑
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatCoach;
