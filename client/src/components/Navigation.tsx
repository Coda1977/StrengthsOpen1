import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface NavigationProps {
  simplified?: boolean;
}

const Navigation = ({ simplified = false }: NavigationProps) => {
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
    { path: '/coach', label: 'AI Coach' }
  ] : [
    { path: '/', label: 'Home' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/encyclopedia', label: 'Encyclopedia' },
    { path: '/coach', label: 'AI Coach' }
  ];

  return (
    <nav className="app-nav">
      <div className="nav-container">
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
              onClick={(e) => {
                console.log('Navigation clicked:', item.path);
                console.log('Current location:', location);
                setMobileMenuOpen(false);
                // Force navigation by updating window location as fallback
                if (item.path !== location) {
                  setTimeout(() => {
                    window.location.href = item.path;
                  }, 100);
                }
              }}
            >
              {item.label}
            </Link>
          ))}
          
          {isAuthenticated && (
            <button 
              onClick={() => window.location.href = '/api/logout'}
              className="nav-item"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Logout
            </button>
          )}
        </div>
        
        <button 
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          ☰
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
