import React from "react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface NavigationProps {
  simplified?: boolean;
  onChatHamburgerClick?: () => void;
}

const Navigation = ({ simplified = false, onChatHamburgerClick }: NavigationProps) => {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();

  // Show simplified nav for landing page
  if (simplified) {
    return (
      <nav className="app-nav">
        <div className="nav-container">
          <Link href="/" className="logo">Strengths Manager</Link>
        </div>
      </nav>
    );
  }

  // Show app navigation for authenticated users who completed onboarding
  const navItems = isAuthenticated && (user as any)?.hasCompletedOnboarding ? [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/encyclopedia', label: 'Encyclopedia' },
    { path: '/ai-coach', label: 'AI Coach' }
  ] : [
    { path: '/', label: 'Home' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/encyclopedia', label: 'Encyclopedia' },
    { path: '/ai-coach', label: 'AI Coach' }
  ];

  // Add admin link only for the specific admin user
  if (user?.email === 'tinymanagerai@gmail.com') {
    navItems.push({ path: '/admin', label: 'Admin' });
  }

  return (
    <nav className="app-nav">
      <div className="nav-container">
        {/* Left hamburger for chat/history (only on chat/coach pages) */}
        {(location.includes('/coach') || location.includes('/chat')) && (
          <button
            className="chat-hamburger-btn"
            onClick={onChatHamburgerClick}
            aria-label="Open chat history"
            style={{ marginRight: 16, background: '#e0e7ff', color: '#1e40af', borderRadius: '50%', border: 'none', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>
          </button>
        )}
        <Link 
          href={isAuthenticated && (user as any)?.hasCompletedOnboarding ? "/dashboard" : "/"} 
          className="logo"
        >
          Strengths Manager
        </Link>
        
        <div className={`nav-menu ${mobileMenuOpen ? 'active' : ''}`}>
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`nav-item ${location === item.path ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
              tabIndex={0}
              aria-label={item.label}
            >
              {item.label}
            </Link>
          ))}
          
          {isAuthenticated && (
            <button 
              onClick={() => window.location.href = '/api/logout'}
              className="nav-item"
              style={{ background: 'none', border: 'none', cursor: 'pointer', minWidth: 44, minHeight: 44 }}
              tabIndex={0}
              aria-label="Logout"
            >
              Logout
            </button>
          )}
        </div>
        
        <button 
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Open app menu"
        >
          ☰
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
