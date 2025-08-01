import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { ChevronRight } from "lucide-react";

const allStrengths = [
  'Achiever', 'Activator', 'Adaptability', 'Analytical', 'Arranger',
  'Belief', 'Command', 'Communication', 'Competition', 'Connectedness',
  'Consistency', 'Context', 'Deliberative', 'Developer', 'Discipline',
  'Empathy', 'Focus', 'Futuristic', 'Harmony', 'Ideation',
  'Includer', 'Individualization', 'Input', 'Intellection', 'Learner',
  'Maximizer', 'Positivity', 'Relator', 'Responsibility', 'Restorative',
  'Self-Assurance', 'Significance', 'Strategic', 'Woo'
];

const Onboarding = () => {
  const [name, setName] = useState('');
  const [selectedStrengths, setSelectedStrengths] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Initialize name from user data
  useEffect(() => {
    if (user && user.firstName) {
      setName(`${user.firstName} ${user.lastName || ''}`.trim());
    }
  }, [user]);

  // Redirect to login if explicitly not authenticated (but not while loading)
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log('[ONBOARDING] Redirecting to login - not authenticated');
      // Add delay to prevent redirect loops during session reconciliation
      const timeoutId = setTimeout(() => {
        window.location.href = '/api/login';
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [isAuthenticated, isLoading]);

  // Redirect to dashboard if already completed onboarding
  useEffect(() => {
    if (user && user.hasCompletedOnboarding) {
      console.log('[ONBOARDING] User has completed onboarding, redirecting to dashboard');
      console.log('[ONBOARDING] User data:', { 
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        firstName: user.firstName,
        email: user.email 
      });
      setLocation('/dashboard');
    }
  }, [user, setLocation]);

  // Show loading state while authentication is being determined
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  const filteredStrengths = allStrengths.filter(strength =>
    strength.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onboardingMutation = useMutation({
    mutationFn: async (data: { hasCompletedOnboarding: boolean; topStrengths: string[]; firstName?: string; lastName?: string }) => {
      return await apiRequest('POST', '/api/onboarding', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/dashboard");
    },
  });

  const handleStrengthToggle = (strength: string) => {
    if (selectedStrengths.includes(strength)) {
      setSelectedStrengths(selectedStrengths.filter(s => s !== strength));
    } else if (selectedStrengths.length < 5) {
      setSelectedStrengths([...selectedStrengths, strength]);
    }
  };

  const canContinue = name.trim() && selectedStrengths.length === 5;

  const handleContinue = () => {
    if (canContinue) {
      // Parse the name into first and last name
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      
      onboardingMutation.mutate({
        hasCompletedOnboarding: true,
        topStrengths: selectedStrengths,
        firstName: firstName,
        lastName: lastName,
      });
    }
  };

  if (!user) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#F5F0E8', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #FFD60A',
            borderTop: '4px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p style={{ color: '#4A4A4A' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#F5F0E8', 
      padding: '2rem 1rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 48px)',
            fontWeight: '700',
            letterSpacing: '-1px',
            color: '#1A1A1A',
            marginBottom: '0.5rem'
          }}>
            Let's Get Started
          </h1>
          <p style={{
            fontSize: '18px',
            color: '#4A4A4A',
            lineHeight: '1.7'
          }}>
            Tell us your name and select your top 5 CliftonStrengths
          </p>
        </div>

        {/* Main Card */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '2.5rem',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
          marginBottom: '2rem'
        }}>
          {/* Name Input */}
          <div style={{ marginBottom: '2.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '18px',
              fontWeight: '600',
              color: '#1A1A1A',
              marginBottom: '0.75rem'
            }}>
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              style={{
                width: '100%',
                padding: '1rem 1.25rem',
                fontSize: '16px',
                border: '2px solid #E5E7EB',
                borderRadius: '12px',
                backgroundColor: '#FFFFFF',
                transition: 'border-color 0.2s ease',
                outline: 'none'
              }}
              onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = '#003566'}
              onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = '#E5E7EB'}
            />
          </div>

          {/* Strengths Selection */}
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <label style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#1A1A1A'
              }}>
                Select Your Top 5 CliftonStrengths
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

            {/* Search */}
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search strengths..."
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                fontSize: '14px',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                marginBottom: '1rem',
                outline: 'none'
              }}
              onFocus={(e) => (e.target as HTMLInputElement).style.borderColor = '#003566'}
              onBlur={(e) => (e.target as HTMLInputElement).style.borderColor = '#D1D5DB'}
            />

            {/* Selected Strengths Display */}
            {selectedStrengths.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  {selectedStrengths.map((strength, index) => (
                    <div
                      key={strength}
                      style={{
                        background: '#FFD60A',
                        color: '#1A1A1A',
                        padding: '0.5rem 1rem',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <span style={{ 
                        fontSize: '12px', 
                        fontWeight: '700',
                        backgroundColor: '#1A1A1A',
                        color: '#FFD60A',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {index + 1}
                      </span>
                      {strength}
                      <button
                        onClick={() => handleStrengthToggle(strength)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#1A1A1A',
                          cursor: 'pointer',
                          fontSize: '16px',
                          lineHeight: '1',
                          padding: '0',
                          marginLeft: '0.25rem'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '0.75rem',
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '0.5rem',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              backgroundColor: '#FAFAFA'
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
                      padding: '0.75rem 0.5rem',
                      border: isSelected ? '2px solid #003566' : '2px solid #E5E7EB',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? '#003566' : '#FFFFFF',
                      color: isSelected ? '#FFFFFF' : isDisabled ? '#9CA3AF' : '#1A1A1A',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      opacity: isDisabled ? 0.5 : 1,
                      textAlign: 'center'
                    }}
                    onMouseEnter={(e) => {
                      if (!isDisabled && !isSelected) {
                        (e.target as HTMLButtonElement).style.borderColor = '#003566';
                        (e.target as HTMLButtonElement).style.backgroundColor = '#F0F9FF';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        (e.target as HTMLButtonElement).style.borderColor = '#E5E7EB';
                        (e.target as HTMLButtonElement).style.backgroundColor = '#FFFFFF';
                      }
                    }}
                  >
                    {strength}
                  </button>
                );
              })}
            </div>

            {selectedStrengths.length < 5 && (
              <p style={{
                fontSize: '14px',
                color: '#6B7280',
                marginTop: '1rem',
                textAlign: 'center'
              }}>
                Select {5 - selectedStrengths.length} more strength{5 - selectedStrengths.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* Continue Button */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={handleContinue}
            disabled={!canContinue || onboardingMutation.isPending}
            style={{
              background: canContinue && !onboardingMutation.isPending ? '#1A1A1A' : '#9CA3AF',
              color: '#F5F0E8',
              padding: '1rem 2.5rem',
              borderRadius: '25px',
              border: 'none',
              fontSize: '18px',
              fontWeight: '600',
              cursor: canContinue && !onboardingMutation.isPending ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              margin: '0 auto',
              transform: canContinue && !onboardingMutation.isPending ? 'translateY(0)' : 'translateY(0)',
              boxShadow: canContinue && !onboardingMutation.isPending ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (canContinue && !onboardingMutation.isPending) {
                (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
                (e.target as HTMLButtonElement).style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (canContinue && !onboardingMutation.isPending) {
                (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
                (e.target as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }
            }}
          >
            {onboardingMutation.isPending ? 'Saving...' : 'Continue to Dashboard'}
            {!onboardingMutation.isPending && <ChevronRight size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;