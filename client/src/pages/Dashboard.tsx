import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import Navigation from '../components/Navigation';

const strengthsDomain: { [key: string]: string } = {
  'Achiever': 'Executing', 'Activator': 'Influencing', 'Adaptability': 'Relationship Building', 'Analytical': 'Strategic Thinking', 'Arranger': 'Executing',
  'Belief': 'Executing', 'Command': 'Influencing', 'Communication': 'Influencing', 'Competition': 'Influencing', 'Connectedness': 'Relationship Building',
  'Consistency': 'Executing', 'Context': 'Strategic Thinking', 'Deliberative': 'Executing', 'Developer': 'Relationship Building', 'Discipline': 'Executing',
  'Empathy': 'Relationship Building', 'Focus': 'Executing', 'Futuristic': 'Strategic Thinking', 'Harmony': 'Relationship Building', 'Ideation': 'Strategic Thinking',
  'Includer': 'Relationship Building', 'Individualization': 'Relationship Building', 'Input': 'Strategic Thinking', 'Intellection': 'Strategic Thinking', 'Learner': 'Strategic Thinking',
  'Maximizer': 'Influencing', 'Positivity': 'Relationship Building', 'Relator': 'Relationship Building', 'Responsibility': 'Executing', 'Restorative': 'Executing',
  'Self-Assurance': 'Influencing', 'Significance': 'Influencing', 'Strategic': 'Strategic Thinking', 'Woo': 'Influencing'
};

const allStrengths = [
  'Achiever', 'Activator', 'Adaptability', 'Analytical', 'Arranger',
  'Belief', 'Command', 'Communication', 'Competition', 'Connectedness',
  'Consistency', 'Context', 'Deliberative', 'Developer', 'Discipline',
  'Empathy', 'Focus', 'Futuristic', 'Harmony', 'Ideation',
  'Includer', 'Individualization', 'Input', 'Intellection', 'Learner',
  'Maximizer', 'Positivity', 'Relator', 'Responsibility', 'Restorative',
  'Self-Assurance', 'Significance', 'Strategic', 'Woo'
];

interface TeamMember {
  id: string;
  name: string;
  strengths: string[];
}

const Dashboard = () => {
  const [refreshCount, setRefreshCount] = useState(3);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [memberName, setMemberName] = useState('');
  const [selectedStrengths, setSelectedStrengths] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch team members
  const { data: teamMembers = [], isLoading: teamMembersLoading, error: teamMembersError } = useQuery({
    queryKey: ['/api/team-members'],
  });

  const createMemberMutation = useMutation({
    mutationFn: async (data: { name: string; strengths: string[] }) => {
      return await apiRequest('POST', '/api/team-members', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      resetModal();
    },
    onError: (error) => {
      console.error('Failed to create team member:', error);
      alert('Failed to add team member. Please try again.');
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; strengths: string[] } }) => {
      return await apiRequest('PUT', `/api/team-members/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      resetModal();
    },
    onError: (error) => {
      console.error('Failed to update team member:', error);
      alert('Failed to update team member. Please try again.');
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/team-members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
    },
    onError: (error) => {
      console.error('Failed to delete team member:', error);
      alert('Failed to delete team member. Please try again.');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/upload-team-members', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      alert(`Successfully created ${data.members.length} team members from file`);
    },
    onError: (error) => {
      console.error('Failed to upload file:', error);
      alert(`Failed to upload file: ${error.message}`);
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
    // Reset the input
    event.target.value = '';
  };

  const resetModal = () => {
    setShowAddModal(false);
    setEditingMember(null);
    setMemberName('');
    setSelectedStrengths([]);
    setSearchTerm('');
  };

  const openAddModal = () => {
    resetModal();
    setShowAddModal(true);
  };

  const openEditModal = (member: TeamMember) => {
    setEditingMember(member);
    setMemberName(member.name);
    setSelectedStrengths(member.strengths);
    setShowAddModal(true);
  };

  const handleSaveMember = () => {
    if (memberName.trim() && selectedStrengths.length > 0) {
      const data = { name: memberName.trim(), strengths: selectedStrengths };
      
      if (editingMember) {
        updateMemberMutation.mutate({ id: editingMember.id, data });
      } else {
        createMemberMutation.mutate(data);
      }
    }
  };

  const handleDeleteMember = (id: string) => {
    if (confirm('Are you sure you want to delete this team member?')) {
      deleteMemberMutation.mutate(id);
    }
  };

  const handleStrengthToggle = (strength: string) => {
    if (selectedStrengths.includes(strength)) {
      setSelectedStrengths(selectedStrengths.filter(s => s !== strength));
    } else if (selectedStrengths.length < 5) {
      setSelectedStrengths([...selectedStrengths, strength]);
    }
  };

  const filteredStrengths = allStrengths.filter(strength =>
    strength.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate domain distribution
  const calculateDomainDistribution = () => {
    const allTeamStrengths = [
      ...(user?.topStrengths || []),
      ...teamMembers.flatMap((member: TeamMember) => member.strengths || [])
    ];

    const domainCounts = {
      'Executing': 0,
      'Influencing': 0,
      'Relationship Building': 0,
      'Strategic Thinking': 0
    };

    allTeamStrengths.forEach((strength: string) => {
      const domain = strengthsDomain[strength];
      if (domain) {
        domainCounts[domain as keyof typeof domainCounts]++;
      }
    });

    const total = Object.values(domainCounts).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(domainCounts).map(([domain, count]) => ({
      domain,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }));
  };

  const domainDistribution = calculateDomainDistribution();

  const [teamInsight, setTeamInsight] = useState("Click 'Refresh' to generate your team insight based on your actual strengths data.");

  const [collaborationInsight, setCollaborationInsight] = useState<string>('');
  const [loadingCollaboration, setLoadingCollaboration] = useState(false);

  const generateCollaborationMutation = useMutation({
    mutationFn: async ({ member1, member2 }: { member1: string; member2: string }) => {
      const response = await apiRequest('POST', '/api/generate-collaboration-insight', { member1, member2 });
      return await response.json();
    },
    onSuccess: (data: any) => {
      const insight = data?.insight || 'No insight generated';
      const cleanInsight = typeof insight === 'string' 
        ? insight
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
            .replace(/\*(.*?)\*/g, '$1')     // Remove italic markdown
            .replace(/\. /g, '.\n\n') // Add line breaks after sentences
            .replace(/: /g, ':\n• ') // Convert colons to bullet points
            .replace(/\n• ([^•\n]*)\./g, '\n• $1.\n') // Ensure bullet points end with line breaks
            .trim()
        : 'Unable to process insight';
      setCollaborationInsight(cleanInsight);
      setLoadingCollaboration(false);
    },
    onError: (error) => {
      console.error('Failed to generate collaboration insight:', error);
      setCollaborationInsight('Unable to generate collaboration insight at this time.');
      setLoadingCollaboration(false);
    },
  });

  const generateCollaborationInsight = (member1: string, member2: string) => {
    setLoadingCollaboration(true);
    generateCollaborationMutation.mutate({ member1, member2 });
  };

  const getCollaborationKey = () => {
    if (selectedMembers.length === 2) {
      return selectedMembers.sort().join(' & ');
    }
    return '';
  };

  const generateInsightMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/generate-team-insight');
      return await response.json();
    },
    onSuccess: (data: any) => {
      const insight = data?.insight || 'No insight generated';
      const cleanInsight = typeof insight === 'string' 
        ? insight
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
            .replace(/\*(.*?)\*/g, '$1')     // Remove italic markdown
            .trim()
        : 'Unable to process insight';
      setTeamInsight(cleanInsight);
      setRefreshCount(refreshCount - 1);
    },
    onError: (error) => {
      console.error('Failed to generate team insight:', error);
      alert('Failed to generate new insight. Please try again.');
    },
  });

  const handleRefreshInsight = () => {
    if (refreshCount > 0) {
      generateInsightMutation.mutate();
    }
  };

  const handleMemberSelection = (memberName: string) => {
    let newSelection: string[];
    
    if (selectedMembers.includes(memberName)) {
      newSelection = selectedMembers.filter(name => name !== memberName);
    } else if (selectedMembers.length < 2) {
      newSelection = [...selectedMembers, memberName];
    } else {
      newSelection = [selectedMembers[1], memberName];
    }
    
    setSelectedMembers(newSelection);
    
    // Generate collaboration insight when 2 members are selected
    if (newSelection.length === 2) {
      generateCollaborationInsight(newSelection[0], newSelection[1]);
    } else {
      setCollaborationInsight('');
    }
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
            <div className="overview-header">
              <h2 className="card-title">Team Synergy</h2>
              <div className="overview-actions">
                <input
                  type="file"
                  id="file-upload"
                  accept=".csv,.xlsx,.xls,.pdf,.docx,.doc,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button 
                  className="upload-btn" 
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload File'}
                </button>
                <button className="add-member-btn" onClick={() => openAddModal()}>+</button>
              </div>
            </div>
            {teamMembersLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid #f3f3f3',
                  borderTop: '3px solid #003566',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem'
                }}></div>
                <p>Loading team members...</p>
              </div>
            ) : teamMembersError ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#DC2626' }}>
                <p>Error loading team members. Please try again.</p>
              </div>
            ) : (
              <>
            <div className="team-grid">
              {teamMembers.map((member: TeamMember) => (
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
              </>
            )}
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
                    disabled={refreshCount === 0 || generateInsightMutation.isPending}
                  >
                    {generateInsightMutation.isPending ? 'Generating...' : `Refresh (${refreshCount} left)`}
                  </button>
                </div>
                {generateInsightMutation.isPending ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      border: '3px solid #f3f3f3',
                      borderTop: '3px solid #003566',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 1rem'
                    }}></div>
                    <p style={{ fontSize: '16px', color: '#6B7280' }}>Generating team insight...</p>
                  </div>
                ) : (
                  <p className="insight-text">
                    {teamInsight}
                  </p>
                )}
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
                {teamMembers.map((member: TeamMember) => (
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
                    {loadingCollaboration ? (
                      <div style={{ textAlign: 'center', padding: '1rem' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          border: '2px solid #f3f3f3',
                          borderTop: '2px solid #003566',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          margin: '0 auto 0.5rem'
                        }}></div>
                        <p style={{ fontSize: '14px', color: '#6B7280' }}>Generating collaboration insight...</p>
                      </div>
                    ) : (
                      <div className="insight-text" style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>
                        {collaborationInsight || "Select two team members to see collaboration insights."}
                      </div>
                    )}
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