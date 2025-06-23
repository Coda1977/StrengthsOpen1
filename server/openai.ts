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

  const prompt = `You are an expert CliftonStrengths coach analyzing a team composition. Generate a practical, actionable team insight based on this data:

MANAGER'S TOP 5 STRENGTHS:
${managerStrengths.join(', ')}

TEAM MEMBERS:
${teamMembers.map(member => `${member.name}: ${member.strengths.join(', ')}`).join('\n')}

OVERALL TEAM COMPOSITION:
- Total people: ${teamMembers.length + 1} (including manager)
- Domain distribution: ${Object.entries(domainCounts).map(([domain, count]) => `${domain}: ${count}`).join(', ')}
- Most common strengths: ${Object.entries(strengthCounts).filter(([_, count]) => count > 1).map(([strength, count]) => `${strength} (${count})`).join(', ') || 'No duplicates'}

Generate a concise, actionable insight (2-3 sentences) that:
1. Identifies the team's primary strength or potential challenge
2. Provides a specific, practical recommendation for team development or collaboration
3. Is encouraging and focuses on leveraging strengths rather than fixing weaknesses

Keep the tone professional but warm, and make it immediately actionable.`;

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

Generate a specific, actionable insight (1-2 sentences) about how these two people can work together effectively based on their CliftonStrengths. Focus on:
1. How their strengths complement each other
2. A specific collaboration strategy or project approach they could use
3. What unique value this partnership brings to the team

Keep it practical and immediately actionable.`;

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
      max_tokens: 150,
      temperature: 0.7
    });

    return response.choices[0].message.content || "Unable to generate collaboration insight at this time.";
  } catch (error) {
    console.error("Error generating collaboration insight:", error);
    throw new Error("Failed to generate collaboration insight");
  }
}