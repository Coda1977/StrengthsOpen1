import { useEffect } from "react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";
import fingerprintImg from '@assets/image_1751180885555.png';

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
      <Navigation simplified={true} />
      <div className="app-content">
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-container">
            <div className="hero-content animate-in">
              <h1>Unlock Performance, one strength at a time</h1>
              <p className="hero-subtitle">From the cradle to the cubicle, we devote more time to our shortcomings than to our strengths, it's time to flip the script!</p>
              <p><span className="yellow-highlight">Strengths Manager</span> will transform your strengths data into actionable coaching.</p>
              <div className="hero-buttons">
                <button 
                  className="primary-button"
                  onClick={() => window.location.href = '/api/login'}
                >
                  Get Started
                </button>
              </div>
            </div>
            <div className="hero-visual animate-in" style={{animationDelay: '0.2s'}}>
              <img
                src={fingerprintImg}
                alt="Colorful fingerprint"
                className="fingerprint-image"
                style={{ 
                  borderRadius: '10px', 
                  width: '400px', 
                  height: '400px',
                  background: 'transparent',
                  filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1))'
                }}
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features" id="features">
          <div className="features-container">
            <div className="features-grid">
              <div className="feature-card animate-in">
                <div className="feature-number">01</div>
                <h4>2-Minute Setup</h4>
                <p>Import your CliftonStrengths or select manually. Add your team members' top 5 strengths. You're ready to lead differently.</p>
              </div>
              <div className="feature-card animate-in" style={{animationDelay: '0.1s'}}>
                <div className="feature-number">02</div>
                <h4>Smart Conversations</h4>
                <p>Our AI coach remembers your context, suggests relevant questions, and builds on previous conversations to deepen your practice.</p>
              </div>
              <div className="feature-card animate-in" style={{animationDelay: '0.2s'}}>
                <div className="feature-number">03</div>
                <h4>Team Dashboard</h4>
                <p>Visualize your team's collective strengths, see domain balance, and identify opportunities for powerful collaborations.</p>
              </div>
              <div className="feature-card animate-in" style={{animationDelay: '0.3s'}}>
                <div className="feature-number">04</div>
                <h4>Partnership Magic</h4>
                <p>Select any two team members and get specific, actionable advice on how to make their partnership exceptional.</p>
              </div>
              <div className="feature-card animate-in" style={{animationDelay: '0.4s'}}>
                <div className="feature-number">05</div>
                <h4>Weekly Nudges</h4>
                <p>Personalized tips every Monday morning that help you apply your strengths and engage your team's unique talents throughout the week.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer CTA */}
      <footer>
        <div className="footer-content animate-in">
          <p>Don't waste time trying to put in what was left out. Try to draw out what was left in.</p>
          <button 
            className="footer-button"
            onClick={() => window.location.href = '/api/login'}
          >
            Get Started
          </button>
        </div>
      </footer>
    </>
  );
};

export default LandingPage;