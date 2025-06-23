import { useEffect } from "react";
import { Link } from "wouter";
import Navigation from "@/components/Navigation";

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
                <a href="#features" className="primary-button">Get Started</a>
              </div>
            </div>
            <div className="hero-visual animate-in" style={{animationDelay: '0.2s'}}>
              {/* Perfect recreation of rainbow fingerprint */}
              <svg className="fingerprint-image" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" style={{borderRadius: '10px'}}>
                <defs>
                  {/* Rainbow gradient matching the image */}
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
                  
                  {/* Spiral color sections */}
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
                  
                  <linearGradient id="orangeSection" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#84cc16'}}/>
                    <stop offset="33%" style={{stopColor:'#f59e0b'}}/>
                    <stop offset="66%" style={{stopColor:'#f97316'}}/>
                    <stop offset="100%" style={{stopColor:'#dc2626'}}/>
                  </linearGradient>
                  
                  <linearGradient id="redSection" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor:'#dc2626'}}/>
                    <stop offset="100%" style={{stopColor:'#92400e'}}/>
                  </linearGradient>
                </defs>
                
                {/* Cream background */}
                <rect width="400" height="400" fill="#f5f0e8"/>
                
                {/* Outer blue ridges */}
                <path d="M200,40 C290,40 360,110 360,200 C360,290 290,360 200,360 C110,360 40,290 40,200 C40,110 110,40 200,40" 
                      fill="none" stroke="url(#blueSection)" strokeWidth="4" strokeLinecap="round"/>
                <path d="M200,55 C280,55 345,120 345,200 C345,280 280,345 200,345 C120,345 55,280 55,200 C55,120 120,55 200,55" 
                      fill="none" stroke="url(#blueSection)" strokeWidth="3.5" strokeLinecap="round"/>
                <path d="M200,70 C270,70 330,130 330,200 C330,270 270,330 200,330 C130,330 70,270 70,200 C70,130 130,70 200,70" 
                      fill="none" stroke="url(#blueSection)" strokeWidth="3" strokeLinecap="round"/>
                <path d="M200,85 C260,85 315,140 315,200 C315,260 260,315 200,315 C140,315 85,260 85,200 C85,140 140,85 200,85" 
                      fill="none" stroke="url(#blueSection)" strokeWidth="2.5" strokeLinecap="round"/>
                
                {/* Green transition ridges */}
                <path d="M200,100 C250,100 300,150 300,200 C300,250 250,300 200,300 C150,300 100,250 100,200 C100,150 150,100 200,100" 
                      fill="none" stroke="url(#greenSection)" strokeWidth="3" strokeLinecap="round"/>
                <path d="M200,115 C240,115 285,160 285,200 C285,240 240,285 200,285 C160,285 115,240 115,200 C115,160 160,115 200,115" 
                      fill="none" stroke="url(#greenSection)" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M200,130 C230,130 270,170 270,200 C270,230 230,270 200,270 C170,270 130,230 130,200 C130,170 170,130 200,130" 
                      fill="none" stroke="url(#greenSection)" strokeWidth="2" strokeLinecap="round"/>
                
                {/* Orange-red inner ridges */}
                <path d="M200,145 C220,145 255,180 255,200 C255,220 220,255 200,255 C180,255 145,220 145,200 C145,180 180,145 200,145" 
                      fill="none" stroke="url(#orangeSection)" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M200,160 C210,160 240,190 240,200 C240,210 210,240 200,240 C190,240 160,210 160,200 C160,190 190,160 200,160" 
                      fill="none" stroke="url(#orangeSection)" strokeWidth="2" strokeLinecap="round"/>
                <path d="M200,175 C205,175 225,195 225,200 C225,205 205,225 200,225 C195,225 175,205 175,200 C175,195 195,175 200,175" 
                      fill="none" stroke="url(#orangeSection)" strokeWidth="1.5" strokeLinecap="round"/>
                
                {/* Center spiral */}
                <path d="M200,190 C202,190 210,198 210,200 C210,202 202,210 200,210 C198,210 190,202 190,200 C190,198 198,190 200,190" 
                      fill="none" stroke="url(#redSection)" strokeWidth="2" strokeLinecap="round"/>
                
                {/* Center core */}
                <circle cx="200" cy="200" r="5" fill="#dc2626"/>
                
                {/* Bottom fingerprint details */}
                <g opacity="0.6" stroke="#92400e" strokeWidth="2" strokeLinecap="round">
                  <path d="M150,340 Q175,345 200,340 Q225,345 250,340"/>
                  <path d="M160,355 Q180,360 200,355 Q220,360 240,355"/>
                  <path d="M170,370 Q185,375 200,370 Q215,375 230,370"/>
                  <path d="M140,350 L150,352 M160,348 L170,350 M180,348 L190,350 M210,348 L220,350 M230,348 L240,350 M250,348 L260,350"/>
                  <path d="M145,365 L155,367 M165,363 L175,365 M185,363 L195,365 M205,363 L215,365 M225,363 L235,365 M245,363 L255,365"/>
                </g>
              </svg>
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
          <Link href="/dashboard" className="footer-button">Get Started</Link>
        </div>
      </footer>
    </>
  );
};

export default LandingPage;
