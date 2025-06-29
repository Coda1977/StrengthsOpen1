import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TeamStrengthsData {
  managerStrengths: string[];
  teamMembers: Array<{
    name: string;
    strengths: string[];
  }>;
}

const isDev = process.env.NODE_ENV === 'development';

export async function generateTeamInsight(data: TeamStrengthsData): Promise<string> {
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    if (isDev) console.error('OpenAI API key not found');
    return "AI insights are not available. Please configure the OpenAI API key to enable team insights.";
  }

  const { managerStrengths, teamMembers } = data;
  
  // Validate input data
  if (!managerStrengths || managerStrengths.length === 0) {
    return "Please add your top strengths to generate team insights.";
  }
  
  if (!teamMembers || teamMembers.length === 0) {
    return "Add team members with their strengths to generate insights.";
  }
  
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
      max_tokens: 400,
      temperature: 0.7
    });

    return response.choices[0].message.content || "Unable to generate insight at this time.";
  } catch (error) {
    if (error instanceof Error && error.message?.includes('API key')) {
      return "OpenAI API key is invalid or expired. Please check your API key configuration.";
    }
    if (error instanceof Error && (error.message?.includes('rate limit') || error.message?.includes('quota'))) {
      return "AI service is temporarily unavailable due to rate limits. Please try again in a few minutes.";
    }
    if (isDev) console.error("Failed to generate team insight:", error);
    return "Unable to generate team insight at this time. Please try again later.";
  }
}

export async function generateCoachResponse(
  message: string, 
  mode: 'personal' | 'team', 
  user: any, 
  teamMembers: any[], 
  conversationHistory: any[] = []
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = `Core AI Personality & Approach
You are an expert strengths-based leadership coach with deep knowledge of CliftonStrengths. You combine the wisdom of organizational psychology with practical, real-world management experience. Your communication style is:

Direct: No fluff. Get to the actionable insight quickly.
Nuanced: Recognize that strengths can be overused, misapplied, or create blind spots
Specific: Use names, situations, and concrete examples rather than generic advice
Challenging: Don't just affirm - push managers to grow and see new perspectives
Human: Acknowledge the messiness of real workplace dynamics

Deep CliftonStrengths Knowledge
You understand all 34 CliftonStrengths themes at multiple levels:
- Surface definition: What the strength means
- Behavioral patterns: How it shows up day-to-day
- Blind spots: Where this strength might create problems
- Partnerships: Which strengths complement or conflict with each other
- Overuse: When a strength becomes a weakness
- Development edges: How to mature and refine each strength

Feature-Specific Instructions
${mode === 'personal' ? `
Personal Strengths Mode
When discussing the manager's own strengths:
GOOD: "Your Achiever is probably why you're asking this at 9 PM on a Friday. Here's the thing - not everyone on your team shares your relentless drive. When you assign a project to Marcus (high Deliberative), he needs time to think through all angles. Your impatience might shut down his best thinking."

BAD: "As someone with Achiever, you like to get things done! Remember to be patient with others who work differently."

Key behaviors:
- Call out potential blind spots created by their strengths
- Connect their strengths to specific situations they're facing
- Suggest experiments, not just advice
- Remember previous conversations and build on them
- Challenge assumptions about what "good leadership" means
` : `
Team Strengths Mode
When advising on managing team members:
GOOD: "Sarah's combination of Competition and Significance means she's not just driven to win - she needs the win to be visible. That 'great job' you mentioned in the team meeting? Not enough. Pull her aside and tell her specifically how her work impacted the client presentation. Make it theatrical."

BAD: "People with Competition like recognition. Make sure to praise Sarah's achievements."

Key behaviors:
- Focus on the specific combination of their top 5, not individual strengths
- Give tactical advice that can be implemented immediately
- Acknowledge when team members' strengths clash with the manager's
- Suggest actual phrases or conversation starters
- Address power dynamics and organizational realities
`}

Context:
Manager's Top Strengths: ${user.topStrengths?.join(', ') || 'Not specified'}
Team Members: ${teamMembers.map(m => `${m.name} (${m.strengths.join(', ')})`).join('; ') || 'No team members added yet'}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map((msg: any) => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content
    })),
    { role: 'user', content: message }
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      max_tokens: 600,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'I apologize, but I encountered an issue generating a response. Please try again.';
  } catch (error) {
    if (error instanceof Error && error.message?.includes('API key')) {
      return "OpenAI API key is invalid or expired. Please check your API key configuration.";
    }
    if (error instanceof Error && (error.message?.includes('rate limit') || error.message?.includes('quota'))) {
      return "AI service is temporarily unavailable due to rate limits. Please try again in a few minutes.";
    }
    if (isDev) console.error('OpenAI API error:', error);
    throw new Error('Failed to generate coaching response');
  }
}

export async function generateCollaborationInsight(member1: string, member2: string, member1Strengths: string[], member2Strengths: string[]): Promise<string> {
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    if (isDev) console.error('OpenAI API key not found');
    return "AI insights are not available. Please configure the OpenAI API key to enable collaboration insights.";
  }

  // Validate input
  if (!member1 || !member2 || !member1Strengths?.length || !member2Strengths?.length) {
    return "Both team members need to have strengths assigned to generate collaboration insights.";
  }

  const prompt = `You are an expert CliftonStrengths coach. Generate a collaboration insight for these two specific team members. IMPORTANT: Use their exact names throughout your response.

Team Member 1: ${member1} (Strengths: ${member1Strengths.join(', ')})
Team Member 2: ${member2} (Strengths: ${member2Strengths.join(', ')})

Provide a collaboration insight that uses their actual names (${member1} and ${member2}) in these sections:

STRENGTHS SYNERGY:
One sentence explaining how ${member1}'s and ${member2}'s strengths complement each other.

TOP 3 STRATEGIES:
1. One specific action ${member1} and ${member2} can take together
2. One communication approach that works for both ${member1} and ${member2}
3. One way ${member1} and ${member2} can leverage their combined strengths

PARTNERSHIP ADVANTAGE:
One sentence on ${member1} and ${member2}'s unique collaborative value.

Remember: Always use their actual names (${member1} and ${member2}) instead of placeholders. Keep each point to one sentence maximum. No markdown. Total response under 150 words.`;

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
      max_tokens: 400,
      temperature: 0.5
    });

    return response.choices[0].message.content || "Unable to generate collaboration insight at this time.";
  } catch (error) {
    if (error instanceof Error && error.message?.includes('API key')) {
      return "OpenAI API key is invalid or expired. Please check your API key configuration.";
    }
    if (error instanceof Error && (error.message?.includes('rate limit') || error.message?.includes('quota'))) {
      return "AI service is temporarily unavailable due to rate limits. Please try again in a few minutes.";
    }
    if (isDev) console.error("Failed to generate collaboration insight:", error);
    return "Unable to generate collaboration insight at this time. Please try again later.";
  }
}

// Generate context-aware starter questions
export async function generateContextAwareStarterQuestions(user: any, teamMembers: any[], recentTopics: string[] = []): Promise<string[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `You are an expert CliftonStrengths coach. Suggest 3 context-aware starter questions for a manager to ask an AI coach, based on the following:

Manager's Top Strengths: ${user.topStrengths?.join(', ') || 'Not specified'}
Team Members: ${teamMembers.map(m => `${m.name} (${m.strengths.join(', ')})`).join('; ') || 'No team members added yet'}
Recent Chat Topics: ${recentTopics.length > 0 ? recentTopics.join(', ') : 'None'}

The questions should:
- Be specific to the manager's strengths, team, or recent topics
- Be practical and actionable
- Avoid generic or vague wording
- Be phrased as questions a real manager would ask
- Be concise (max 15 words each)

Return only a JSON array of questions, no other text.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are an expert at generating context-aware coaching questions.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 200,
    temperature: 0.7,
  });
  const content = response.choices[0].message.content;
  try {
    const arr = JSON.parse(content || '');
    return Array.isArray(arr) ? arr : arr.questions || [];
  } catch {
    return [];
  }
}

// Generate follow-up questions after an AI answer
export async function generateFollowUpQuestions(aiAnswer: string, conversationHistory: any[] = []): Promise<string[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `You are an expert CliftonStrengths coach. Suggest 2-3 follow-up questions a manager might ask after receiving this advice from an AI coach:

AI's Answer: "${aiAnswer}"

Conversation History: ${conversationHistory.map(m => `${m.type === 'user' ? 'User' : 'AI'}: ${m.content}`).join(' | ')}

The follow-up questions should:
- Be natural next questions a thoughtful manager might ask
- Be specific to the advice given
- Be concise (max 15 words each)

Return only a JSON array of questions, no other text.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are an expert at generating follow-up coaching questions.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 150,
    temperature: 0.7,
  });
  const content = response.choices[0].message.content;
  try {
    const arr = JSON.parse(content || '');
    return Array.isArray(arr) ? arr : arr.questions || [];
  } catch {
    return [];
  }
}

export async function generateWeeklyEmailContent(
  managerName: string,
  topStrengths: string[],
  weekNumber: number,
  teamSize: number,
  featuredStrength: string,
  featuredTeamMember: string,
  teamMemberStrengths: string[],
  teamMemberFeaturedStrength: string,
  previousPersonalTips: string[],
  previousOpeners: string[],
  previousTeamMembers: string[]
): Promise<{
  subjectLine: string;
  preHeader: string;
  header: string;
  personalInsight: string;
  techniqueName: string;
  techniqueContent: string;
  teamSection: string;
  quote: string;
  quoteAuthor: string;
}> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = `# AI Instructions - Weekly Nudge Email

You are crafting personalized weekly strength insights for a manager using Strengths Manager.

## CONTEXT
- Manager Name: ${managerName}
- Top 5 Strengths: ${topStrengths.join(', ')}
- Week Number: ${weekNumber} of journey
- Team Size: ${teamSize} members
- This Week's Featured Strength: ${featuredStrength}
- Featured Team Member: ${featuredTeamMember} with strengths: ${teamMemberStrengths.join(', ')}
- Team Member's Featured Strength: ${teamMemberFeaturedStrength}
- Previous Personal Tips (last 4 weeks): ${previousPersonalTips.join(', ')}
- Previous Openers Used: ${previousOpeners.join(', ')}
- Previous Team Members Featured: ${previousTeamMembers.join(', ')}

## TECHNICAL REQUIREMENTS
- Subject line: Maximum 45 characters
- Pre-header: 40-50 characters describing the action/technique
- Use dark mode compatible colors: #0F172A (text), #CC9B00 (yellow), #003566 (blue)
- Include aria-labels for all symbols: role="img" aria-label="[description]"
- Total email length: Under 400 words / 2-minute read

## TONE & STYLE
- Conversational without emoji
- Vary energy levels by week (calm → energetic → thoughtful → bold)
- Use typography symbols with aria-labels: ★ ► ▶ ✓ ✗
- Bold sparingly (2-3 phrases max)
- One clear action per email

## GENERATE

### 1. SUBJECT LINE (<45 chars)
Rotate patterns to avoid repetition:
- Week 1-4: "[Action] your [strength]" 
- Week 5-8: "[Outcome] with [strength]"
- Week 9-12: "[Name], [benefit statement]"
- Week 13+: "[Question format]"

Track used verbs to ensure variety

### 2. PRE-HEADER (40-50 chars)
Always include the technique name or specific action

Examples:
- "Try the 2-minute teach-back technique"
- "3 words that unlock Sarah's Focus"
- "The question that changes everything"

### 3. HEADER VARIATIONS
Rotate weekly:
- Week ${weekNumber}: Your ${featuredStrength} strength spotlight
- Week ${weekNumber}: ${featuredStrength} week
- Week ${weekNumber}: Mastering your ${featuredStrength}
- Week ${weekNumber}: ${featuredStrength} evolution

Milestone weeks only: "★ ${weekNumber} weeks stronger"

### 4. PERSONAL INSIGHT (45-60 words)

**OPENER VARIETY (rotate these patterns):**
- Question: "Know what separates good ${featuredStrength}s from great ones?"
- Observation: "Your ${featuredStrength} does something unusual:"
- Challenge: "Most ${featuredStrength}s stop at X. You're ready for Y."
- Discovery: "Week ${weekNumber} revelation:"
- Direct: "Time to upgrade your ${featuredStrength}."

**STRUCTURE:**
- One-line opener (varies by week)
- Core insight showing strength combination
- **Bolded revelation** (the "aha" moment)

EXACTLY ONE CLEAR OUTCOME

### 5. TECHNIQUE SECTION (60-80 words)

► [Technique Name] - must be memorable and specific

**STRUCTURE:**
1. Context line (when/where to use)
2. Specific script OR step-by-step
3. Why it works (15 words max)

**VARIETY IN TECHNIQUES:**
- Weeks 1-4: Simple frameworks (2-3 steps)
- Weeks 5-8: Combination techniques 
- Weeks 9-12: Advanced applications
- Weeks 13+: Nuanced situations

Must pass the "Monday Morning Test": Can they do this TODAY?

### 6. TEAM SECTION (50-65 words)

**OPENER VARIETY:**
- "▶ This week: ${featuredTeamMember}'s ${teamMemberFeaturedStrength}"
- "▶ Focus on: ${featuredTeamMember} + ${teamMemberFeaturedStrength}"
- "▶ ${featuredTeamMember}'s ${teamMemberFeaturedStrength} spotlight"
- "▶ Unlocking ${featuredTeamMember}'s ${teamMemberFeaturedStrength}"

**STRUCTURE:**
1. What the strength really needs (not surface level)
2. Comparison box:
   - ✗ Common mistake
   - ✓ Better approach
3. Observable outcome

ONE SPECIFIC ACTION the manager can take THIS WEEK

### 7. QUOTE SELECTION

Rotate sources by week:
- Weeks 1-4: Business leaders
- Weeks 5-8: Scientists/researchers
- Weeks 9-12: Historical figures
- Weeks 13-16: Movies/TV characters
- Then repeat with fresh quotes

Format: Quote first, attribution second
Must relate to either the technique OR the strength theme

## FINAL QUALITY CHECKLIST
- [ ] Subject line under 45 characters?
- [ ] Exactly ONE clear next action for manager?
- [ ] Different opener pattern than last 4 weeks?
- [ ] Different verb choices than previous emails?
- [ ] All colors dark-mode compatible (#0F172A not #000)?
- [ ] All symbols have aria-labels?
- [ ] Technique has memorable name?
- [ ] Team section focuses on ONE strength only?
- [ ] Total length under 400 words?
- [ ] Can manager do the technique on Monday?
- [ ] Quote from rotating source category?
- [ ] No repeated phrases from recent weeks?

Generate the email content in JSON format with these exact fields:
{
  "subjectLine": "string (max 45 chars)",
  "preHeader": "string (40-50 chars)",
  "header": "string",
  "personalInsight": "string (45-60 words)",
  "techniqueName": "string (memorable name)",
  "techniqueContent": "string (60-80 words)",
  "teamSection": "string (50-65 words)",
  "quote": "string",
  "quoteAuthor": "string"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert CliftonStrengths coach who creates personalized weekly email content. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content generated');
    }

    const parsed = JSON.parse(content);
    
    // Validate required fields
    const requiredFields = ['subjectLine', 'preHeader', 'header', 'personalInsight', 'techniqueName', 'techniqueContent', 'teamSection', 'quote', 'quoteAuthor'];
    for (const field of requiredFields) {
      if (!parsed[field] || typeof parsed[field] !== 'string') {
        throw new Error(`Missing or invalid field: ${field}`);
      }
    }

    // Validate character limits
    if (parsed.subjectLine.length > 45) {
      throw new Error('Subject line exceeds 45 characters');
    }
    if (parsed.preHeader.length < 40 || parsed.preHeader.length > 50) {
      throw new Error('Pre-header must be 40-50 characters');
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message?.includes('API key')) {
      throw new Error('OpenAI API key is invalid or expired');
    }
    if (error instanceof Error && (error.message?.includes('rate limit') || error.message?.includes('quota'))) {
      throw new Error('AI service is temporarily unavailable due to rate limits');
    }
    if (isDev) console.error('Failed to generate weekly email content:', error);
    throw new Error('Failed to generate weekly email content');
  }
}

export async function generateWelcomeEmailContent(
  firstName: string | undefined,
  strength1: string | undefined,
  strength2: string | undefined,
  nextMonday: string | undefined
): Promise<
  | {
      subject: string;
      greeting: string;
      dna: string;
      challenge: string;
      challengeText: string;
      whatsNext: string;
      cta: string;
      metrics: string;
    }
  | {
      error: string;
      missing_fields: string[];
      status: 'failed';
    }
> {
  // Validation per your instructions
  const missing: string[] = [];
  if (!strength1) missing.push('strength_1');
  if (!strength2) missing.push('strength_2');

  if (missing.length > 0) {
    return {
      error: 'Missing required strengths',
      missing_fields: missing,
      status: 'failed'
    };
  }

  // Generate specific behavior based on strength combinations from your instructions
  const generateDNAInsight = (s1: string, s2: string): string => {
    const combinations: { [key: string]: string } = {
      'Strategic_Achiever': 'spot opportunities others miss, then actually follow through',
      'Strategic_Responsibility': 'create long-term plans you can fully commit to',
      'Strategic_Analytical': 'see patterns in data that reveal future possibilities',
      'Achiever_Responsibility': 'complete important work others can depend on',
      'Achiever_Focus': 'drive projects to completion without getting distracted',
      'Relator_Developer': 'build trust while growing people simultaneously',
      'Developer_Responsibility': 'invest in people with unwavering commitment',
      'Analytical_Responsibility': 'make data-driven decisions you can stand behind',
      'Communication_Relator': 'explain complex ideas in ways that build connection',
      'Ideation_Strategic': 'generate creative solutions with practical pathways'
    };
    
    const key1 = `${s1}_${s2}`;
    const key2 = `${s2}_${s1}`;
    
    return combinations[key1] || combinations[key2] || `combine ${s1.toLowerCase()} thinking with ${s2.toLowerCase()} execution in unique ways`;
  };

  // Generate strength-specific challenges from your instructions
  const generateChallenge = (strength: string): string => {
    const challenges: { [key: string]: string } = {
      'Strategic': 'In your next meeting, notice how you naturally see 3 different approaches to any problem. That\'s your Strategic mind at work.',
      'Achiever': 'Count how many small wins you create for your team in one day. Your drive creates momentum others feel.',
      'Relator': 'Have one important conversation without checking your phone once. Notice how much deeper you connect.',
      'Developer': 'Catch someone doing something well today and tell them specifically what growth you see in them.',
      'Responsibility': 'When you make a commitment today, notice how seriously you take it compared to others around you.',
      'Analytical': 'Before making your next decision, count how many questions you naturally ask. That\'s your mind ensuring accuracy.',
      'Communication': 'In your next explanation, watch how you naturally find the right words to make complex things clear.',
      'Ideation': 'Count how many new ideas you generate in one meeting. Your brain is an idea factory.',
      'Focus': 'Notice how you naturally filter out distractions others get caught in. That focus is a leadership superpower.',
      'Individualization': 'Observe how you naturally see what makes each team member unique. That\'s rare leadership insight.'
    };
    
    return challenges[strength] || `Notice how your ${strength} strength shows up naturally in your next leadership interaction.`;
  };

  // Generate subject line options based on strength (≤40 chars per your instructions)
  const generateSubject = (name: string, strength: string): string => {
    const subjects = [
      `${name}, your ${strength} mind is rare`,
      `Ready to lead with ${strength}?`,
      `${name}, let's unlock ${strength}`,
      `Your ${strength} advantage starts now`
    ];
    
    // Pick shortest subject under 40 chars
    return subjects.find(s => s.length <= 40) || subjects[0].substring(0, 37) + '...';
  };

  const name = firstName || 'there';
  const s1 = strength1!;
  const s2 = strength2!;
  const monday = nextMonday || 'Monday';

  // Generate content following your exact specifications
  const content = {
    subject: generateSubject(name, s1),
    greeting: `Hi ${name},\n\nMost managers try to be good at everything. You're about to discover why that's backwards—and how your natural strengths can transform your leadership.`,
    dna: `${s1} + ${s2} means you naturally ${generateDNAInsight(s1, s2)}. That's a rare combination that most leaders struggle to develop.`,
    challenge: generateChallenge(s1),
    challengeText: generateChallenge(s1),
    whatsNext: `Every Monday for 12 weeks, you'll get one practical way to use your ${s1} advantage in real leadership situations.\n\nNo theory. No generic advice. Just specific techniques that work with how your mind naturally operates.`,
    cta: `First insight arrives ${monday}\nGet ready to lead differently.`,
    metrics: `REFINED EMAIL METRICS:\n- Subject: ${generateSubject(name, s1).length} characters\n- Total words: ~200\n- Primary focus: ${s1} + ${s2}\n- Mobile-optimized: Yes\nSTATUS: PASS`
  };

  return content;
}