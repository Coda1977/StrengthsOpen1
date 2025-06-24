import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useTeamAnalytics, useOptimizedQuery, STRENGTHS_DOMAIN_MAP, ALL_STRENGTHS } from '@/hooks/usePerformanceOptimized';
import { useFileUploadCleanup, useCleanup } from '@/hooks/useCleanup';
import Navigation from '../components/Navigation';

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
  
  // Optimized team members query
  const { data: teamMembers = [], isLoading: teamMembersLoading, error: teamMembersError } = useOptimizedQuery<TeamMember[]>(
    ['/api/team-members'],
    true,
    5 * 60 * 1000
  );

  // Resource cleanup hooks
  const { startUpload, finishUpload } = useFileUploadCleanup();
  const { createTimeout, addCleanup } = useCleanup();

  // Team analytics with safe data
  const teamAnalytics = useTeamAnalytics(teamMembers || []);
  const { topStrengths } = teamAnalytics;

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const abortController = startUpload(`upload-${Date.now()}`);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/upload-team-members', {
          method: 'POST',
          body: formData,
          signal: abortController.signal
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Upload failed');
        }
        return await response.json();
      } finally {
        finishUpload(`upload-${Date.now()}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
    },
    onError: (error: Error) => {
      console.error('Upload failed:', error);
      alert('File upload failed. Please try again.');
    }
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const deleteMemberMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/team-members/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
    }
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: { name: string; strengths: string[] }) => 
      apiRequest('POST', '/api/team-members', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      resetModal();
    }
  });

  const updateMemberMutation = useMutation({
    mutationFn: (data: { id: string; name: string; strengths: string[] }) => 
      apiRequest('PATCH', `/api/team-members/${data.id}`, {
        name: data.name,
        strengths: data.strengths
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      resetModal();
    }
  });

  const generateInsightMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/generate-team-insight', {
        managerStrengths: user?.topStrengths || [],
        teamMembers: teamMembers.map(member => ({
          name: member.name,
          strengths: member.strengths || []
        }))
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      setTeamInsight(data?.insight || 'No insight generated');
      setRefreshCount(prev => Math.max(0, prev - 1));
    },
    onError: (error: Error) => {
      console.error('Failed to generate team insight:', error);
      setTeamInsight('Failed to generate team insight. Please try again.');
    }
  });

  const generateCollaborationMutation = useMutation({
    mutationFn: async ({ member1, member2 }: { member1: string; member2: string }) => {
      const response = await apiRequest('POST', '/api/generate-collaboration-insight', { member1, member2 });
      return await response.json();
    },
    onSuccess: (data: any) => {
      let insight = data?.insight || 'No insight generated';
      if (insight.length > 800) {
        insight = insight.substring(0, 800) + '... [truncated for readability]';
      }
      setCollaborationInsight(insight);
      setLoadingCollaboration(false);
    },
    onError: (error: Error) => {
      console.error('Failed to generate collaboration insight:', error);
      setCollaborationInsight('Failed to generate collaboration insight. Please try again.');
      setLoadingCollaboration(false);
    }
  });

  const openAddModal = () => {
    setShowAddModal(true);
    setEditingMember(null);
    setMemberName('');
    setSelectedStrengths([]);
  };

  const openEditModal = (member: TeamMember) => {
    setShowAddModal(true);
    setEditingMember(member);
    setMemberName(member.name);
    setSelectedStrengths(member.strengths || []);
  };

  const resetModal = () => {
    setShowAddModal(false);
    setEditingMember(null);
    setMemberName('');
    setSelectedStrengths([]);
    setSearchTerm('');
  };

  const handleSubmit = () => {
    if (!memberName.trim()) {
      alert('Please enter a name');
      return;
    }
    
    if (selectedStrengths.length === 0) {
      alert('Please select at least one strength');
      return;
    }

    if (editingMember) {
      updateMemberMutation.mutate({
        id: editingMember.id,
        name: memberName.trim(),
        strengths: selectedStrengths
      });
    } else {
      addMemberMutation.mutate({
        name: memberName.trim(),
        strengths: selectedStrengths
      });
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

  const handleMemberSelection = (memberName: string) => {
    setSelectedMembers(prev => {
      if (prev.includes(memberName)) {
        return prev.filter(name => name !== memberName);
      } else if (prev.length < 2) {
        const newSelection = [...prev, memberName];
        if (newSelection.length === 2) {
          setLoadingCollaboration(true);
          generateCollaborationMutation.mutate({
            member1: newSelection[0],
            member2: newSelection[1]
          });
        }
        return newSelection;
      }
      return prev;
    });
  };

  const handleRefreshInsight = () => {
    if (refreshCount > 0) {
      generateInsightMutation.mutate();
    }
  };

  // Domain distribution calculation
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
      const domain = STRENGTHS_DOMAIN_MAP[strength];
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

  // Filter strengths based on search term
  const filteredStrengths = useMemo(() => {
    if (!searchTerm.trim()) return ALL_STRENGTHS;
    return ALL_STRENGTHS.filter(strength => 
      strength.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  return (
    <div className="dashboard">
      <Navigation />
      
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Team Dashboard</h1>
          <p>Manage your team's strengths and generate insights</p>
        </div>

        <div className="dashboard-content">
          {/* Team Overview Section */}
          <div className="card" style={{ background: 'var(--white)', borderRadius: 'var(--card-radius)', padding: 'var(--card-padding)', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)' }}>
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
          <div className="card" style={{ background: 'var(--white)', borderRadius: 'var(--card-radius)', padding: 'var(--card-padding)', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)' }}>
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
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'var(--white)',
            borderRadius: 'var(--card-radius)',
            padding: 'var(--modal-padding)',
            maxWidth: 'var(--modal-width)',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)'
          }}>
            <h3 style={{ 
              fontSize: '28px', 
              fontWeight: 700, 
              marginBottom: '1.5rem',
              color: 'var(--text-primary)',
              letterSpacing: '-1px'
            }}>
              {editingMember ? 'Edit Team Member' : 'Add Team Member'}
            </h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem'
              }}>
                Name
              </label>
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Enter team member name"
                style={{
                  width: '100%',
                  padding: 'var(--input-padding)',
                  fontSize: '16px',
                  border: '2px solid var(--bg-primary)',
                  borderRadius: 'var(--input-radius)',
                  outline: 'none',
                  transition: 'all 0.3s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent-blue)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(0, 53, 102, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--bg-primary)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem'
              }}>
                Strengths (select up to 5)
              </label>
              
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search strengths..."
                className="search-input"
                style={{
                  marginBottom: '1rem'
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
                onClick={handleSubmit}
                disabled={!memberName.trim() || selectedStrengths.length === 0 || addMemberMutation.isPending || updateMemberMutation.isPending}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor: '#003566',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  cursor: (!memberName.trim() || selectedStrengths.length === 0 || addMemberMutation.isPending || updateMemberMutation.isPending) ? 'not-allowed' : 'pointer',
                  opacity: (!memberName.trim() || selectedStrengths.length === 0 || addMemberMutation.isPending || updateMemberMutation.isPending) ? 0.6 : 1
                }}
              >
                {(addMemberMutation.isPending || updateMemberMutation.isPending) ? 'Saving...' : (editingMember ? 'Update' : 'Add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;