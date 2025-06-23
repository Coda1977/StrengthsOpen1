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
          </div>

          {/* Manager Strengths Card */}
          <div className="card">
            <h2 className="card-title">My Top 5 Strengths</h2>
            <div className="strengths-list">
              {(user?.topStrengths || []).map((strength, index) => (
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
              {teamMembers.map((member: any) => (
                <div key={member.id} className="team-member-card">
                  <button className="delete-btn" onClick={() => handleDeleteMember(member.id)}>×</button>
                  <div className="member-header" onClick={() => openEditModal(member)}>
                    <div className="member-initials">
                      {member.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="member-name">{member.name}</div>
                  </div>
                  <div className="member-strengths">
                    {(member.strengths || []).map((strength: string, index: number) => (
                      <span key={index} className="small-strength">
                        {strength}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="team-member-card add-member-card" onClick={openAddModal}>
                <span className="add-icon">+</span>
              </div>
            </div>

            <h3 style={{fontSize: '20px', fontWeight: 700, marginBottom: '1rem', marginTop: '2rem'}}>Domain Distribution</h3>
            <div className="domain-chart">
              {domainDistribution.map(({ domain, percentage }) => (
                <div key={domain} className="domain-bar">
                  <div className="domain-label">
                    <span>{domain}</span>
                    <span>{percentage}%</span>
                  </div>
                  <div className="bar-container">
                    <div 
                      className={`bar-fill ${domain.toLowerCase().replace(' ', '-')}`} 
                      style={{width: `${percentage}%`}}
                    ></div>
                  </div>
                </div>
              ))}
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
                {teamMembers.map((member: any) => (
                  <button 
                    key={member.id}
                    className={`member-btn ${selectedMembers.includes(member.name) ? 'selected' : ''}`}
                    onClick={() => handleMemberSelection(member.name)}
                  >
                    {member.name}
                  </button>
                ))}
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

      {/* Add/Edit Member Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '2.5rem',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1A1A1A', margin: 0 }}>
                {editingMember ? 'Edit Team Member' : 'Add Team Member'}
              </h2>
              <button
                onClick={resetModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#9CA3AF'
                }}
              >
                ×
              </button>
            </div>

            {/* Name Input */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block',
                fontSize: '16px',
                fontWeight: '600',
                color: '#1A1A1A',
                marginBottom: '0.5rem'
              }}>
                Name
              </label>
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Enter team member's name"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '14px',
                  border: '2px solid #E5E7EB',
                  borderRadius: '8px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Strengths Selection */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <label style={{ fontSize: '16px', fontWeight: '600', color: '#1A1A1A' }}>
                  Select Strengths (up to 5)
                </label>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: selectedStrengths.length === 5 ? '#059669' : '#4A4A4A',
                  backgroundColor: selectedStrengths.length === 5 ? '#D1FAE5' : '#F3F4F6',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px'
                }}>
                  {selectedStrengths.length}/5
                </span>
              </div>

              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search strengths..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  fontSize: '14px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  outline: 'none'
                }}
              />

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: '0.5rem',
                maxHeight: '200px',
                overflowY: 'auto',
                padding: '0.5rem',
                border: '1px solid #E5E7EB',
                borderRadius: '6px'
              }}>
                {filteredStrengths.map((strength) => {
                  const isSelected = selectedStrengths.includes(strength);
                  const isDisabled = !isSelected && selectedStrengths.length >= 5;
                  
                  return (
                    <button
                      key={strength}
                      onClick={() => !isDisabled && handleStrengthToggle(strength)}
                      disabled={isDisabled}
                      style={{
                        padding: '0.5rem',
                        border: isSelected ? '2px solid #003566' : '1px solid #E5E7EB',
                        borderRadius: '6px',
                        backgroundColor: isSelected ? '#003566' : '#FFFFFF',
                        color: isSelected ? '#FFFFFF' : isDisabled ? '#9CA3AF' : '#1A1A1A',
                        fontSize: '12px',
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.5 : 1
                      }}
                    >
                      {strength}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={resetModal}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  color: '#4A4A4A',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMember}
                disabled={!memberName.trim() || selectedStrengths.length === 0 || createMemberMutation.isPending || updateMemberMutation.isPending}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: memberName.trim() && selectedStrengths.length > 0 ? '#1A1A1A' : '#9CA3AF',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  cursor: memberName.trim() && selectedStrengths.length > 0 ? 'pointer' : 'not-allowed'
                }}
              >
                {(createMemberMutation.isPending || updateMemberMutation.isPending) ? 'Saving...' : editingMember ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;
