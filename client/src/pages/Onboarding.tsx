import { useState } from "react";
import { useNavigate } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

const strengthsData = [
  "Achiever", "Activator", "Adaptability", "Analytical", "Arranger", "Belief",
  "Command", "Communication", "Competition", "Connectedness", "Consistency", "Context",
  "Deliberative", "Developer", "Discipline", "Empathy", "Focus", "Futuristic",
  "Harmony", "Ideation", "Includer", "Individualization", "Input", "Intellection",
  "Learner", "Maximizer", "Positivity", "Relator", "Responsibility", "Restorative",
  "Self-Assurance", "Significance", "Strategic", "Woo"
];

const Onboarding = () => {
  const [selectedStrengths, setSelectedStrengths] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const onboardingMutation = useMutation({
    mutationFn: async (data: { hasCompletedOnboarding: boolean; topStrengths: string[] }) => {
      return await apiRequest('/api/onboarding', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/dashboard");
    },
  });

  const handleStrengthToggle = (strength: string) => {
    if (selectedStrengths.includes(strength)) {
      setSelectedStrengths(selectedStrengths.filter(s => s !== strength));
    } else if (selectedStrengths.length < 5) {
      setSelectedStrengths([...selectedStrengths, strength]);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2 && selectedStrengths.length === 5) {
      onboardingMutation.mutate({
        hasCompletedOnboarding: true,
        topStrengths: selectedStrengths,
      });
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-primary-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent-yellow mx-auto"></div>
          <p className="mt-4 text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-bg">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {step === 1 && (
          <div className="text-center">
            <h1 className="text-4xl font-bold text-text-primary mb-6">
              Welcome to Strengths Manager, {user.firstName || 'there'}!
            </h1>
            <p className="text-xl text-text-secondary mb-12 max-w-2xl mx-auto">
              Let's get you set up so you can start exploring and developing your unique strengths.
            </p>
            
            <div className="bg-white rounded-lg p-8 max-w-2xl mx-auto shadow-lg">
              <h2 className="text-2xl font-semibold text-text-primary mb-4">
                What you'll do:
              </h2>
              <div className="space-y-4 text-left">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-accent-yellow rounded-full flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <p className="text-text-secondary">
                    Select your top 5 CliftonStrengths themes
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-accent-yellow rounded-full flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <p className="text-text-secondary">
                    Get personalized insights and development recommendations
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-accent-yellow rounded-full flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  <p className="text-text-secondary">
                    Access your dashboard, encyclopedia, and AI coach
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleNext}
                className="mt-8 bg-text-primary text-white px-8 py-3 rounded-full font-semibold hover:bg-opacity-90 transition-all"
              >
                Let's Get Started
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-text-primary mb-4">
                Select Your Top 5 Strengths
              </h1>
              <p className="text-text-secondary mb-2">
                Choose the 5 CliftonStrengths themes that best describe you.
              </p>
              <p className="text-sm text-text-secondary">
                Selected: {selectedStrengths.length} / 5
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
              {strengthsData.map((strength) => {
                const isSelected = selectedStrengths.includes(strength);
                const canSelect = selectedStrengths.length < 5 || isSelected;
                
                return (
                  <button
                    key={strength}
                    onClick={() => handleStrengthToggle(strength)}
                    disabled={!canSelect}
                    className={`
                      p-4 rounded-lg text-center font-medium transition-all
                      ${isSelected 
                        ? 'bg-accent-yellow text-text-primary border-2 border-accent-yellow' 
                        : canSelect
                          ? 'bg-white text-text-secondary border-2 border-transparent hover:border-text-primary'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }
                    `}
                  >
                    {strength}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-between max-w-2xl mx-auto">
              <button
                onClick={handleBack}
                className="px-6 py-3 text-text-secondary hover:text-text-primary transition-colors"
              >
                ← Back
              </button>
              
              <button
                onClick={handleNext}
                disabled={selectedStrengths.length !== 5 || onboardingMutation.isPending}
                className="bg-text-primary text-white px-8 py-3 rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-90 transition-all"
              >
                {onboardingMutation.isPending ? 'Saving...' : 'Complete Setup'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;