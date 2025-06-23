import { useEffect } from "react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";

const LandingPage = () => {
  useEffect(() => {
    // Simple animation trigger for fade-in effects
    const animatedElements = document.querySelectorAll('.animate-in');
    animatedElements.forEach((el, index) => {
      setTimeout(() => {
        (el as HTMLElement).style.opacity = '1';
      }, index * 200);
    });
  }, []);

  return (
    <>
      <Navigation />
      <div className="app-content">
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-container">
            <div className="hero-content animate-in">
              <h1>Unlock Performance, one strength at a time</h1>
              <p className="hero-subtitle">From the cradle to the cubicle, we devote more time to our shortcomings than to our strengths, it's time to flip the script!</p>
              <p><span className="yellow-highlight">Strengths Manager</span> will transform your strengths data into actionable coaching.</p>
              <div className="hero-buttons">
                <Link href="/dashboard" className="primary-button">Get Started</Link>
              </div>
            </div>
            <div className="hero-visual animate-in" style={{animationDelay: '0.2s'}}>
              {/* Rainbow fingerprint SVG */}
              <svg className="fingerprint-image" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" style={{borderRadius: '10px'}}>
                <defs>
                  <linearGradient id="rainbowGrad" x1="50%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#1e40af'}}/>
                    <stop offset="15%" style={{stopColor:'#0ea5e9'}}/>
                    <stop offset="30%" style={{stopColor:'#06b6d4'}}/>
                    <stop offset="45%" style={{stopColor:'#10b981'}}/>
                    <stop offset="60%" style={{stopColor:'#84cc16'}}/>
                    <stop offset="75%" style={{stopColor:'#f59e0b'}}/>
                    <stop offset="85%" style={{stopColor:'#f97316'}}/>
                    <stop offset="95%" style={{stopColor:'#dc2626'}}/>
                    <stop offset="100%" style={{stopColor:'#92400e'}}/>
                  </linearGradient>
                  
                  <linearGradient id="blueSection" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#1e40af'}}/>
                    <stop offset="50%" style={{stopColor:'#0ea5e9'}}/>
                    <stop offset="100%" style={{stopColor:'#06b6d4'}}/>
                  </linearGradient>
                  
                  <linearGradient id="greenSection" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#06b6d4'}}/>
                    <stop offset="50%" style={{stopColor:'#10b981'}}/>
                    <stop offset="100%" style={{stopColor:'#84cc16'}}/>
                  </linearGradient>
                  
                  <linearGradient id="yellowSection" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#84cc16'}}/>
                    <stop offset="50%" style={{stopColor:'#f59e0b'}}/>
                    <stop offset="100%" style={{stopColor:'#f97316'}}/>
                  </linearGradient>
                  
                  <linearGradient id="redSection" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#f97316'}}/>
                    <stop offset="50%" style={{stopColor:'#dc2626'}}/>
                    <stop offset="100%" style={{stopColor:'#92400e'}}/>
                  </linearGradient>
                </defs>
                
                {/* Fingerprint pattern with rainbow gradient */}
                <g fill="none" stroke="url(#rainbowGrad)" strokeWidth="3" strokeLinecap="round">
                  {/* Concentric fingerprint lines */}
                  <path d="M200,50 C250,50 300,100 300,150 C300,200 250,250 200,250 C150,250 100,200 100,150 C100,100 150,50 200,50"/>
                  <path d="M200,70 C240,70 280,110 280,150 C280,190 240,230 200,230 C160,230 120,190 120,150 C120,110 160,70 200,70"/>
                  <path d="M200,90 C230,90 260,120 260,150 C260,180 230,210 200,210 C170,210 140,180 140,150 C140,120 170,90 200,90"/>
                  <path d="M200,110 C220,110 240,130 240,150 C240,170 220,190 200,190 C180,190 160,170 160,150 C160,130 180,110 200,110"/>
                  <path d="M200,130 C210,130 220,140 220,150 C220,160 210,170 200,170 C190,170 180,160 180,150 C180,140 190,130 200,130"/>
                  
                  {/* Additional curved lines for fingerprint detail */}
                  <path d="M150,100 Q200,80 250,100 Q280,130 250,160 Q200,180 150,160 Q120,130 150,100"/>
                  <path d="M170,120 Q200,110 230,120 Q250,140 230,160 Q200,170 170,160 Q150,140 170,120"/>
                  <path d="M180,140 Q200,135 220,140 Q230,150 220,160 Q200,165 180,160 Q170,150 180,140"/>
                </g>
                
                {/* Center dot */}
                <circle cx="200" cy="150" r="5" fill="url(#rainbowGrad)"/>
              </svg>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features" id="features">
          <div className="features-container">
            <div className="features-grid">
              <div className="feature-card animate-in" style={{animationDelay: '0.4s'}}>
                <div className="feature-number">01</div>
                <h4>Discover Your Strengths</h4>
                <p>Import your CliftonStrengths results and explore a comprehensive encyclopedia of all 34 talent themes with detailed insights and development strategies.</p>
              </div>
              <div className="feature-card animate-in" style={{animationDelay: '0.6s'}}>
                <div className="feature-number">02</div>
                <h4>Build Your Team</h4>
                <p>Analyze team dynamics, identify complementary strengths, and discover collaboration opportunities to maximize collective performance.</p>
              </div>
              <div className="feature-card animate-in" style={{animationDelay: '0.8s'}}>
                <div className="feature-number">03</div>
                <h4>AI-Powered Coaching</h4>
                <p>Get personalized development insights and actionable strategies through our intelligent coaching assistant tailored to your unique strengths profile.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default LandingPage;
