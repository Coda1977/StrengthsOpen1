import { useState } from "react";
import Navigation from "@/components/Navigation";

const Dashboard = () => {
  const [currentView, setCurrentView] = useState('overview');
  
  // Mock data for demonstration
  const managerStrengths = ['Strategic', 'Achiever', 'Learner', 'Responsibility', 'Focus'];
  const teamMembers = [
    { id: 1, name: 'Sarah Johnson', initials: 'SJ', strengths: ['Empathy', 'Developer', 'Positivity'] },
    { id: 2, name: 'Mike Chen', initials: 'MC', strengths: ['Analytical', 'Discipline', 'Deliberative'] },
    { id: 3, name: 'Alex Rivera', initials: 'AR', strengths: ['Communication', 'Woo', 'Activator'] }
  ];

  return (
    <>
      <Navigation />
      <div className="app-content">
        <div className="dashboard-container">
          <div className="dashboard-header">
            <h1>Your Strengths Dashboard</h1>
            <p>Manage your team's CliftonStrengths and unlock collective potential</p>
          </div>

          {/* Manager Strengths Card */}
          <div className="card">
            <h3 className="card-title">Your Top 5 Strengths</h3>
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
            <h3 className="card-title">Team Synergy Analysis</h3>
            <div className="team-grid">
              {teamMembers.map((member) => (
                <div key={member.id} className="team-member-card">
                  <div className="member-header">
                    <div className="member-initials">{member.initials}</div>
                    <div className="member-name">{member.name}</div>
                  </div>
                  <div className="member-strengths">
                    {member.strengths.map((strength, index) => (
                      <div key={index} className="small-strength">
                        {strength}
                      </div>
                    ))}
                  </div>
                  <button className="delete-btn">×</button>
                </div>
              ))}
              <div className="team-member-card add-member-card">
                <div className="add-icon">+</div>
              </div>
            </div>
            <button className="action-btn">Analyze Team Dynamics</button>
          </div>

          {/* Domain Distribution */}
          <div className="card">
            <h3 className="card-title">Strengths Domain Distribution</h3>
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
                  <span>20%</span>
                </div>
                <div className="bar-container">
                  <div className="bar-fill influencing" style={{width: '20%'}}></div>
                </div>
              </div>
              <div className="domain-bar">
                <div className="domain-label">
                  <span>Relationship Building</span>
                  <span>25%</span>
                </div>
                <div className="bar-container">
                  <div className="bar-fill relationship" style={{width: '25%'}}></div>
                </div>
              </div>
              <div className="domain-bar">
                <div className="domain-label">
                  <span>Strategic Thinking</span>
                  <span>20%</span>
                </div>
                <div className="bar-container">
                  <div className="bar-fill strategic" style={{width: '20%'}}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
