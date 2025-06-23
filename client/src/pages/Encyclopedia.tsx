import { useState } from "react";
import Navigation from "@/components/Navigation";

const Encyclopedia = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // Mock strengths data
  const strengths = [
    {
      id: 1,
      name: 'Achiever',
      domain: 'Executing',
      domainClass: 'executing',
      description: 'People who are especially talented in the Achiever theme have a great deal of stamina and work hard.',
      quote: 'Your Achiever theme helps explain your drive. You may be the one who... works tirelessly toward a goal.'
    },
    {
      id: 2,
      name: 'Activator',
      domain: 'Influencing',
      domainClass: 'influencing',
      description: 'People who are especially talented in the Activator theme can make things happen by turning thoughts into action.',
      quote: 'Your Activator theme makes you impatient for action. You may find that you are the catalyst...'
    },
    {
      id: 3,
      name: 'Adaptability',
      domain: 'Relationship Building',
      domainClass: 'relationship',
      description: 'People who are especially talented in the Adaptability theme prefer to "go with the flow."',
      quote: 'Your Adaptability theme enables you to stay productive when the demands of work...'
    },
    {
      id: 4,
      name: 'Analytical',
      domain: 'Strategic Thinking',
      domainClass: 'strategic',
      description: 'People who are especially talented in the Analytical theme search for reasons and causes.',
      quote: 'Your Analytical theme challenges other people: Prove it. Show me why what you are claiming is true.'
    },
    {
      id: 5,
      name: 'Arranger',
      domain: 'Executing',
      domainClass: 'executing',
      description: 'People who are especially talented in the Arranger theme can organize, but they also have a flexibility.',
      quote: 'Your Arranger theme makes you a great example of effectiveness, but can you explain why?'
    },
    {
      id: 6,
      name: 'Belief',
      domain: 'Executing',
      domainClass: 'executing',
      description: 'People who are especially talented in the Belief theme have certain core values that are unchanging.',
      quote: 'Your Belief theme causes you to be family-oriented, altruistic, even spiritual...'
    }
  ];

  const domains = [
    { id: 'all', name: 'All Domains', color: '#4A4A4A' },
    { id: 'executing', name: 'Executing', color: '#e74c3c' },
    { id: 'influencing', name: 'Influencing', color: '#f39c12' },
    { id: 'relationship', name: 'Relationship Building', color: '#3498db' },
    { id: 'strategic', name: 'Strategic Thinking', color: '#9b59b6' }
  ];

  const filteredStrengths = strengths.filter(strength => {
    const matchesSearch = strength.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        strength.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === 'all' || strength.domainClass === activeFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <>
      <Navigation />
      <div className="app-content">
        <div className="encyclopedia-container">
          <div className="page-header">
            <h1>CliftonStrengths Encyclopedia</h1>
            <p>Discover and explore all 34 talent themes in detail</p>
          </div>

          {/* Search and Filter Controls */}
          <div className="controls-section">
            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder="Search strengths..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="domain-filters">
              {domains.map((domain) => (
                <button
                  key={domain.id}
                  className={`filter-btn ${activeFilter === domain.id ? 'active' : ''}`}
                  onClick={() => setActiveFilter(domain.id)}
                >
                  <span className="domain-dot" style={{backgroundColor: domain.color}}></span>
                  {domain.name}
                </button>
              ))}
            </div>
          </div>

          {/* Statistics */}
          <div className="controls-section">
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-number">34</div>
                <div className="stat-label">Total Strengths</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">4</div>
                <div className="stat-label">Domains</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">{filteredStrengths.length}</div>
                <div className="stat-label">Filtered Results</div>
              </div>
            </div>
          </div>

          {/* Strengths Grid */}
          <div className="strengths-grid">
            {filteredStrengths.map((strength) => (
              <div key={strength.id} className={`strength-card ${strength.domainClass}`}>
                <div className="strength-header">
                  <h3 className="strength-title">{strength.name}</h3>
                  <div className="strength-domain">
                    <span className="domain-dot" style={{backgroundColor: domains.find(d => d.id === strength.domainClass)?.color}}></span>
                    {strength.domain}
                  </div>
                </div>
                <p className="strength-description">{strength.description}</p>
                <div className="strength-quote">"{strength.quote}"</div>
              </div>
            ))}
          </div>

          {filteredStrengths.length === 0 && (
            <div className="controls-section" style={{textAlign: 'center', padding: '4rem 2rem'}}>
              <h3>No strengths found</h3>
              <p>Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Encyclopedia;
