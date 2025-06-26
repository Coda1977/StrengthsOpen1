import { useEffect } from "react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import fingerprintImg from '../assets/rainbow-fingerprint.svg';

const LandingPage = () => {
  useEffect(() => {
    // Smooth scrolling for anchor links
    const handleAnchorClick = (e: Event) => {
      const target = e.target as HTMLAnchorElement;
      if (target.tagName === 'A' && target.getAttribute('href')?.startsWith('#')) {
        e.preventDefault();
        const targetElement = document.querySelector(target.getAttribute('href')!);
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);

    // Intersection Observer for animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).style.animationPlayState = 'running';
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    document.querySelectorAll('.animate-in').forEach(el => {
      (el as HTMLElement).style.animationPlayState = 'paused';
      observer.observe(el);
    });

    return () => {
      document.removeEventListener('click', handleAnchorClick);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <Navigation />
      
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title animate-in">
                Transform Your Team with 
                <span className="hero-highlight"> Strengths-Based Leadership</span>
              </h1>
              <p className="hero-description animate-in">
                Unlock your team's potential with AI-powered coaching that turns CliftonStrengths data into actionable insights for better collaboration and performance.
              </p>
              <div className="hero-actions animate-in">
                <Link href="/dashboard">
                  <button className="cta-button primary">
                    Get Started Free
                  </button>
                </Link>
                <a href="#features">
                  <button className="cta-button secondary">
                    Learn More
                  </button>
                </a>
              </div>
            </div>
            <div className="hero-visual animate-in">
              <div className="fingerprint-container">
                <img 
                  src={fingerprintImg} 
                  alt="Unique Strengths Fingerprint" 
                  className="fingerprint-image"
                />
                <div className="fingerprint-glow"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <div className="section-header animate-in">
            <h2 className="section-title">Powerful Features for Modern Leaders</h2>
            <p className="section-description">
              Everything you need to build high-performing teams through strengths-based leadership
            </p>
          </div>
          
          <div className="features-grid">
            <div className="feature-card animate-in">
              <div className="feature-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="feature-title">AI-Powered Insights</h3>
              <p className="feature-description">
                Get personalized coaching recommendations based on your team's unique strengths combination
              </p>
            </div>

            <div className="feature-card animate-in">
              <div className="feature-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M23 21V19C23 18.1645 22.7155 17.3541 22.2094 16.6977C21.7033 16.0414 20.9983 15.5743 20.2 15.369" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55332C18.7122 5.25592 19.0078 6.11872 19.0078 7.005C19.0078 7.89128 18.7122 8.75408 18.1676 9.45668C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="feature-title">Team Management</h3>
              <p className="feature-description">
                Easily manage your team members and their CliftonStrengths profiles in one central dashboard
              </p>
            </div>

            <div className="feature-card animate-in">
              <div className="feature-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 20V19C21 16.7909 19.2091 15 17 15H1V19C1 19.5523 1.44772 20 2 20H21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55332C18.7122 5.25592 19.0078 6.11872 19.0078 7.005C19.0078 7.89128 18.7122 8.75408 18.1676 9.45668C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="feature-title">Collaboration Insights</h3>
              <p className="feature-description">
                Discover how team members can best work together based on their complementary strengths
              </p>
            </div>

            <div className="feature-card animate-in">
              <div className="feature-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="feature-title">Strengths Encyclopedia</h3>
              <p className="feature-description">
                Access comprehensive information about all 34 CliftonStrengths themes with detailed descriptions
              </p>
            </div>

            <div className="feature-card animate-in">
              <div className="feature-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="feature-title">AI Coach</h3>
              <p className="feature-description">
                Get instant coaching advice and development strategies tailored to your team's strengths profile
              </p>
            </div>

            <div className="feature-card animate-in">
              <div className="feature-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 9L12 6L16 10L21 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="feature-title">Analytics Dashboard</h3>
              <p className="feature-description">
                Visualize your team's strengths distribution and identify areas for optimal performance
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits-section">
        <div className="container">
          <div className="benefits-content">
            <div className="benefits-text">
              <h2 className="section-title animate-in">Why Strengths-Based Leadership Works</h2>
              <div className="benefits-list">
                <div className="benefit-item animate-in">
                  <div className="benefit-number">3.2x</div>
                  <div className="benefit-text">
                    <h4>Higher Engagement</h4>
                    <p>Teams that focus on strengths show significantly higher engagement levels</p>
                  </div>
                </div>
                <div className="benefit-item animate-in">
                  <div className="benefit-number">73%</div>
                  <div className="benefit-text">
                    <h4>Reduced Turnover</h4>
                    <p>Strengths-focused teams experience lower employee turnover rates</p>
                  </div>
                </div>
                <div className="benefit-item animate-in">
                  <div className="benefit-number">12.5%</div>
                  <div className="benefit-text">
                    <h4>Productivity Increase</h4>
                    <p>Organizations see measurable productivity improvements with strengths-based management</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content animate-in">
            <h2 className="cta-title">Ready to Unlock Your Team's Potential?</h2>
            <p className="cta-description">
              Join thousands of leaders who are transforming their teams with strengths-based coaching
            </p>
            <Link href="/dashboard">
              <button className="cta-button primary large">
                Start Your Free Trial
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h3 className="footer-title">Strengths Manager</h3>
              <p className="footer-description">
                Empowering leaders to build high-performing teams through strengths-based coaching and AI-powered insights.
              </p>
            </div>
            <div className="footer-section">
              <h4 className="footer-heading">Product</h4>
              <ul className="footer-links">
                <li><Link href="/dashboard">Dashboard</Link></li>
                <li><Link href="/encyclopedia">Strengths Guide</Link></li>
                <li><Link href="/coach">AI Coach</Link></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4 className="footer-heading">Resources</h4>
              <ul className="footer-links">
                <li><a href="#features">Features</a></li>
                <li><a href="https://www.gallup.com/cliftonstrengths/en/home.aspx" target="_blank" rel="noopener noreferrer">CliftonStrengths</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 Strengths Manager. Built for leaders who believe in the power of strengths.</p>
          </div>
        </div>
      </footer>
    </>
  );
};

export default LandingPage;