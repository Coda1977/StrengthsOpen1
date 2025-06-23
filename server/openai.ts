import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TeamStrengthsData {
  managerStrengths: string[];
  teamMembers: Array<{
    name: string;
    strengths: string[];
  }>;
}

export async function generateTeamInsight(data: TeamStrengthsData): Promise<string> {
  const { managerStrengths, teamMembers } = data;
  
  // Create a comprehensive prompt with team composition
  const allStrengths = [
    ...managerStrengths,
    ...teamMembers.flatMap(member => member.strengths)
  ];
  
  const strengthCounts = allStrengths.reduce((acc, strength) => {
    acc[strength] = (acc[strength] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const domainMapping = {
    'Executing': ['Achiever', 'Arranger', 'Belief', 'Consistency', 'Deliberative', 'Discipline', 'Focus', 'Responsibility', 'Restorative'],
    'Influencing': ['Activator', 'Command', 'Communication', 'Competition', 'Maximizer', 'Self-Assurance', 'Significance', 'Woo'],
    'Relationship Building': ['Adaptability', 'Connectedness', 'Developer', 'Empathy', 'Harmony', 'Includer', 'Individualization', 'Positivity', 'Relator'],
    'Strategic Thinking': ['Analytical', 'Context', 'Futuristic', 'Ideation', 'Input', 'Intellection', 'Learner', 'Strategic']
  };

  const domainCounts = Object.entries(domainMapping).reduce((acc, [domain, strengths]) => {
    acc[domain] = strengths.filter(strength => allStrengths.includes(strength)).length;
    return acc;
  }, {} as Record<string, number>);

  const totalStrengths = Object.values(domainCounts).reduce((sum, count) => sum + count, 0);
  const domainPercentages = Object.entries(domainCounts).map(([domain, count]) => 
    `${domain}: ${totalStrengths > 0 ? Math.round((count / totalStrengths) * 100) : 0}%`
  ).join(', ');

  const prompt = `You are an expert strengths-based leadership coach with deep knowledge of CliftonStrengths. Generate a team-level insight based on the following team composition:

Manager's Top 5 Strengths: ${managerStrengths.join(', ')}
Team Members and Their Strengths:
${teamMembers.map(member => `- ${member.name}: ${member.strengths.join(', ')}`).join('\n')}

Domain Distribution:
${domainPercentages}

Provide a direct, actionable insight that:
1. Identifies a specific pattern or opportunity in the team's collective strengths
2. Suggests ONE concrete action the manager can take this week
3. Is specific enough to implement immediately

Keep the response to 2-3 sentences maximum. No fluff. Be nuanced - acknowledge both the power and potential blind spots of this team composition. Use vivid, memorable language that sticks.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert CliftonStrengths coach who provides actionable team development insights."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.7
    });

    return response.choices[0].message.content || "Unable to generate insight at this time.";
  } catch (error) {
    console.error("Error generating team insight:", error);
    throw new Error("Failed to generate team insight");
  }
}

export async function generateCollaborationInsight(member1: string, member2: string, member1Strengths: string[], member2Strengths: string[]): Promise<string> {
  const prompt = `You are an expert CliftonStrengths coach. Generate a collaboration insight for these two team members:

${member1}: ${member1Strengths.join(', ')}
${member2}: ${member2Strengths.join(', ')}

Provide a concise collaboration insight with these 3 sections:

STRENGTHS SYNERGY:
One sentence on how their strengths complement each other.

TOP 3 STRATEGIES:
1. One specific action they can take together
2. One communication approach that works for both
3. One way to leverage their combined strengths

PARTNERSHIP ADVANTAGE:
One sentence on their unique collaborative value.

Keep each point to one sentence maximum. No markdown. Total response under 150 words.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert CliftonStrengths coach who provides actionable collaboration insights."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.5
    });

    let content = response.choices[0].message.content || "Unable to generate collaboration insight at this time.";
    
    // Aggressively handle truncation - if response doesn't end properly, find last complete thought
    if (content.length > 50) {
      // Check if ends mid-word or mid-sentence
      if (!content.match(/[.!?]\s*$/) || content.match(/\w+\.\.\.$/) || content.endsWith('...')) {
        // Find all complete sentences
        const sentences = content.match(/[^.!?]*[.!?]/g);
        if (sentences && sentences.length > 0) {
          // Take all complete sentences
          content = sentences.join(' ').trim();
        } else {
          // If no complete sentences, find complete bullet points or sections
          const bulletPoints = content.match(/^[^•\n]*•[^•]*(?=[•]|$)/gm);
          if (bulletPoints && bulletPoints.length > 0) {
            content = bulletPoints.join('\n').trim();
          } else {
            // Last resort: truncate at last period before truncation
            const lastPeriodIndex = content.lastIndexOf('.');
            if (lastPeriodIndex > 20) {
              content = content.substring(0, lastPeriodIndex + 1);
            }
          }
        }
      }
    }
    
    return content;
  } catch (error) {
    console.error("Error generating collaboration insight:", error);
    throw new Error("Failed to generate collaboration insight");
  }
}