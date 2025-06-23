import { useState } from "react";
import Navigation from "@/components/Navigation";

const Dashboard = () => {
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [refreshCount, setRefreshCount] = useState(3);
  
  // Mock data matching the HTML exactly
  const managerStrengths = ['Strategic', 'Achiever', 'Learner', 'Responsibility', 'Analytical'];
  const teamMembers = [
    { id: 1, name: 'John Doe', initials: 'JD', strengths: ['Communication', 'Empathy', 'Developer'] },
    { id: 2, name: 'Sarah Smith', initials: 'SS', strengths: ['Focus', 'Competition'] }
  ];

  const teamInsight = "Your team excels in Executing and Relationship Building domains, creating a powerful combination of getting things done while maintaining strong connections. Consider organizing team challenges that leverage both - like collaborative sprints where pairs work together on time-bound projects. This could amplify your collective productivity while strengthening bonds.";

  const collaborationInsights: Record<string, string> = {
    "You,John Doe": "Your Strategic thinking combined with John's Communication strength creates a powerful dynamic for vision setting and stakeholder engagement. You can craft the direction while John translates it into compelling narratives that inspire action.",
    "You,Sarah Smith": "Your Learner theme pairs beautifully with Sarah's Focus - you bring curiosity and new insights while she ensures sustained attention to priorities. This creates an excellent research and execution partnership.",
    "John Doe,Sarah Smith": "John's Developer strength and Sarah's Competition create an interesting dynamic - John focuses on growing others while Sarah drives performance standards. Together they can create a culture of supportive excellence."
  };

  const handleMemberSelection = (memberName: string) => {
    setSelectedMembers(prev => {
      if (prev.includes(memberName)) {
        return prev.filter(name => name !== memberName);
      } else if (prev.length < 2) {
        return [...prev, memberName];
      } else {
        return [prev[1], memberName];
      }
    });
  };

  const handleRefreshInsight = () => {
    if (refreshCount > 0) {
      setRefreshCount(prev => prev - 1);
      // In a real app, this would generate a new insight
    }
  };

  const getCollaborationKey = () => {
    return selectedMembers.sort().join(',');
  };

  return (
    <>
      <Navigation />
      <div className="app-content">
        <div className="dashboard-container">
          <div className="dashboard-header">
            <h1>Team Strengths Dashboard</h1>
            <p>Empower your team through strengths-based leadership</p>
          </div>

          {/* Manager Strengths Card */}
          <div className="card">
            <h2 className="card-title">My Top 5 Strengths</h2>
            <div className="strengths-list">
              {managerStrengths.map((strength, index) => (
                <span key={index} className="strength-pill">
                  {strength}
                </span>
              ))}
            </div>
            <button className="edit-btn">Edit Strengths</button>
          </div>

          {/* Team Synergy Section */}
          <div className="card">
            <h2 className="card-title">Team Synergy</h2>
            <div className="team-grid">
              {teamMembers.map((member) => (
                <div key={member.id} className="team-member-card">
                  <button className="delete-btn">×</button>
                  <div className="member-header">
                    <div className="member-initials">{member.initials}</div>
                    <div className="member-name">{member.name}</div>
                  </div>
                  <div className="member-strengths">
                    {member.strengths.map((strength, index) => (
                      <span key={index} className="small-strength">
                        {strength}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="team-member-card add-member-card">
                <span className="add-icon">+</span>
              </div>
            </div>

            <h3 style={{fontSize: '20px', fontWeight: 700, marginBottom: '1rem', marginTop: '2rem'}}>Domain Distribution</h3>
            <div className="domain-chart">
              <div className="domain-bar">
                <div className="domain-label">
                  <span>Executing</span>
                  <span>35%</span>
                </div>
                <div className="bar-container">
                  <div className="bar-fill executing" style={{width: '35%'}}></div>
                </div>
              </div>
              <div className="domain-bar">
                <div className="domain-label">
                  <span>Influencing</span>
                  <span>25%</span>
                </div>
                <div className="bar-container">
                  <div className="bar-fill influencing" style={{width: '25%'}}></div>
                </div>
              </div>
              <div className="domain-bar">
                <div className="domain-label">
                  <span>Relationship Building</span>
                  <span>30%</span>
                </div>
                <div className="bar-container">
                  <div className="bar-fill relationship" style={{width: '30%'}}></div>
                </div>
              </div>
              <div className="domain-bar">
                <div className="domain-label">
                  <span>Strategic Thinking</span>
                  <span>10%</span>
                </div>
                <div className="bar-container">
                  <div className="bar-fill strategic" style={{width: '10%'}}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Insights Section */}
          <div className="card">
            <h2 className="card-title">Insights</h2>
            
            <div className="insight-section">
              <div className="insight-box">
                <div className="insight-header">
                  <h3 className="insight-title">Team Insight</h3>
                  <button 
                    className="refresh-btn" 
                    onClick={handleRefreshInsight}
                    disabled={refreshCount === 0}
                  >
                    Refresh ({refreshCount} left)
                  </button>
                </div>
                <p className="insight-text">
                  {teamInsight}
                </p>
              </div>
            </div>

            <div className="collaboration-section">
              <p className="collaboration-prompt">Click on two names below to see collaboration insights:</p>
              <div className="member-buttons">
                <button 
                  className={`member-btn ${selectedMembers.includes('You') ? 'selected' : ''}`}
                  onClick={() => handleMemberSelection('You')}
                >
                  You
                </button>
                <button 
                  className={`member-btn ${selectedMembers.includes('John Doe') ? 'selected' : ''}`}
                  onClick={() => handleMemberSelection('John Doe')}
                >
                  John Doe
                </button>
                <button 
                  className={`member-btn ${selectedMembers.includes('Sarah Smith') ? 'selected' : ''}`}
                  onClick={() => handleMemberSelection('Sarah Smith')}
                >
                  Sarah Smith
                </button>
              </div>
              
              {selectedMembers.length === 2 && (
                <div>
                  <div className="selected-members">
                    Selected: {selectedMembers.join(' & ')}
                  </div>
                  <div className="insight-box">
                    <p className="insight-text">
                      {collaborationInsights[getCollaborationKey()] || "Collaboration insight not available for this combination."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
