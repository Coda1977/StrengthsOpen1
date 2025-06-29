import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/Navigation";

const Encyclopedia = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedStrength, setSelectedStrength] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [, setLocation] = useLocation();

  // Complete CliftonStrengths data
  const strengthsData: Record<string, any> = {
    'Achiever': {
      domain: 'Executing',
      brief: 'People with Achiever have a constant need for attainment. They feel every day must be productive.',
      full: 'Your Achiever theme helps explain your drive. Achiever describes a constant need for achievement. You feel as if every day starts at zero. By the end of the day you must achieve something tangible in order to feel good about yourself. And by "every day" you mean every single day—workdays, weekends, vacations. No matter how much you may feel you deserve a day of rest, if the day passes without some form of achievement, no matter how small, you will feel dissatisfied.',
      quote: 'I have to rack up points every day to feel successful. By 30 minutes into my day, I\'ve probably already accomplished several tasks.',
      workingWith: [
        'Recognize their need for achievement and help them track accomplishments',
        'Assign them challenging goals with measurable outcomes',
        'Partner them with Strategic or Focus talents to ensure efforts align with priorities'
      ],
      potentialBlindSpots: [
        'May sacrifice quality for quantity',
        'Can burn out themselves and others',
        'Might struggle to celebrate successes before moving to the next task'
      ]
    },
    'Activator': {
      domain: 'Influencing',
      brief: 'Activators make things happen by turning thoughts into action. They want to do things now.',
      full: '"When can we start?" This is a recurring question in your life. You are impatient for action. You may concede that analysis has its uses or that debate and discussion can occasionally yield some valuable insights, but deep down you know that only action is real. Only action can make things happen. Only action leads to performance.',
      quote: 'I can\'t stand meetings that end without clear action items. Let\'s stop talking and start doing!',
      workingWith: [
        'Involve them when you need to kick-start a stalled project',
        'Partner them with Strategic or Analytical to ensure action is directed wisely',
        'Give them freedom to make decisions and act quickly'
      ],
      potentialBlindSpots: [
        'May act before thinking things through',
        'Can frustrate those who need time to process',
        'Might start many things but not follow through'
      ]
    },
    'Adaptability': {
      domain: 'Relationship Building',
      brief: 'People with Adaptability prefer to go with the flow. They take things as they come and discover the future one day at a time.',
      full: 'You live in the moment. You don\'t see the future as a fixed destination. Instead, you see it as a place that you create out of the choices that you make right now. You discover your future one choice at a time. This doesn\'t mean that you don\'t have plans. You probably do. But this theme of Adaptability enables you to respond willingly to the demands of the moment even if they pull you away from your plans.',
      quote: 'I don\'t get stressed when plans change. I actually find it energizing to figure things out on the fly.',
      workingWith: [
        'Place them in roles that require flexibility and quick responses',
        'Use them as a calming influence during times of change',
        'Partner them with Focus or Discipline to maintain long-term direction'
      ],
      potentialBlindSpots: [
        'May appear directionless or uncommitted',
        'Can frustrate those who prefer structure',
        'Might avoid necessary planning'
      ]
    },
    'Analytical': {
      domain: 'Strategic Thinking',
      brief: 'Analytical people search for reasons and causes. They think about all factors that might affect a situation.',
      full: 'Your Analytical theme challenges other people: "Prove it. Show me why what you are claiming is true." In the face of this kind of questioning some will find that their brilliant theories wither and die. For you, this is precisely the point. You do not necessarily want to destroy other people\'s ideas, but you do insist that their theories be sound. You see yourself as objective and dispassionate.',
      quote: 'I need data. I can\'t make decisions based on gut feelings alone - show me the evidence.',
      workingWith: [
        'Provide them with data and time to analyze before expecting decisions',
        'Use them to vet important proposals and identify potential flaws',
        'Partner them with Activator or Command to move from analysis to action'
      ],
      potentialBlindSpots: [
        'May experience "analysis paralysis"',
        'Can be seen as overly critical or negative',
        'Might miss opportunities that require quick action'
      ]
    },
    'Arranger': {
      domain: 'Executing',
      brief: 'Arrangers can organize, but they also have a flexibility that complements this ability. They like to determine how all the pieces and resources can be arranged for maximum productivity.',
      full: 'You are a conductor. When faced with a complex situation involving many factors, you enjoy managing all the variables, aligning and realigning them until you are sure you have arranged them in the most productive configuration possible. You are shining at your best when managing many things at once.',
      quote: 'I love juggling multiple projects. Give me all the pieces and I\'ll figure out the best way to make them work together.',
      workingWith: [
        'Put them in charge of complex, multi-faceted projects',
        'Allow them flexibility to rearrange resources and schedules',
        'Partner them with Focus to ensure changes align with core objectives'
      ],
      potentialBlindSpots: [
        'May create too much change and confuse others',
        'Can overlook the human impact of constant rearranging',
        'Might juggle so many things that some get dropped'
      ]
    },
    'Belief': {
      domain: 'Executing',
      brief: 'People with Belief have certain core values that are unchanging. These values guide their decisions and give them purpose.',
      full: 'If you possess a strong Belief theme, you have certain core values that are enduring. These values vary from one person to another, but ordinarily your Belief theme causes you to be family-oriented, altruistic, even spiritual, and to value responsibility and high ethics—both in yourself and others.',
      quote: 'I can\'t work on something that doesn\'t align with my values. The work has to matter, not just the paycheck.',
      workingWith: [
        'Connect their work to a larger purpose or mission',
        'Respect their values and don\'t ask them to compromise',
        'Use them to inspire others with purpose-driven leadership'
      ],
      potentialBlindSpots: [
        'May be inflexible when values are challenged',
        'Can judge others who don\'t share their beliefs',
        'Might struggle in environments that conflict with their values'
      ]
    },
    'Command': {
      domain: 'Influencing',
      brief: 'People with Command have presence. They take control of situations and make decisions with ease.',
      full: 'Command leads you to take charge. Unlike some people, you feel no discomfort with imposing your views on others. On the contrary, once your opinion is formed, you need to share it with others. When you know that you are right, you need others to know it too.',
      quote: 'Someone has to step up and make the tough calls. I\'d rather make a decision and adjust than wait forever.',
      workingWith: [
        'Give them authority to make decisions in their area',
        'Use them in crisis situations that need quick, decisive action',
        'Partner them with Empathy or Harmony to soften their approach'
      ],
      potentialBlindSpots: [
        'May intimidate others or shut down input',
        'Can be seen as bossy or domineering',
        'Might make decisions without adequate consultation'
      ]
    },
    'Communication': {
      domain: 'Influencing',
      brief: 'Communicators find it easy to put their thoughts into words. They are good conversationalists and presenters.',
      full: 'You like to explain, to describe, to host, to speak in public, and to write. This is your Communication theme at work. Ideas are a dry beginning. Events are static. You feel a need to bring them to life, to energize them, to make them exciting and vivid.',
      quote: 'I think out loud. Talking through ideas helps me clarify them and bring others along on the journey.',
      workingWith: [
        'Have them present important initiatives to gain buy-in',
        'Use them to facilitate meetings and discussions',
        'Partner them with Analytical to ensure accuracy in messaging'
      ],
      potentialBlindSpots: [
        'May talk more than listen',
        'Can oversimplify complex topics',
        'Might dominate conversations'
      ]
    },
    'Competition': {
      domain: 'Influencing',
      brief: 'People with Competition measure their progress by comparing themselves to others. They strive to win.',
      full: 'Competition is rooted in comparison. When you look at the world, you are instinctively aware of other people\'s performance. Their performance is the ultimate yardstick. No matter how hard you tried, no matter how worthy your intentions, if you reached your goal but did not outperform your peers, the achievement feels hollow.',
      quote: 'I need to know the score. How am I doing compared to others? Second place is just the first loser.',
      workingWith: [
        'Create metrics and rankings to motivate them',
        'Use competitive situations to bring out their best',
        'Partner them with Harmony to maintain team cohesion'
      ],
      potentialBlindSpots: [
        'May create unhealthy competition within teams',
        'Can focus on winning at the expense of other values',
        'Might struggle in collaborative environments'
      ]
    },
    'Connectedness': {
      domain: 'Relationship Building',
      brief: 'People with Connectedness believe all things are linked. They see the bigger picture and how everything fits together.',
      full: 'Things happen for a reason. You are sure of it. You are sure of it because in your soul you know that we are all connected. Yes, we are individuals, responsible for our own judgments and in possession of our own free will, but nonetheless we are part of something larger.',
      quote: 'Everything we do has ripple effects. I can\'t help but see how this decision will impact not just us, but everyone connected to us.',
      workingWith: [
        'Help them see how their work contributes to the bigger picture',
        'Use them to build bridges between disparate groups',
        'Partner them with Focus to balance big-picture with immediate needs'
      ],
      potentialBlindSpots: [
        'May get lost in philosophical considerations',
        'Can be seen as impractical or "woo-woo"',
        'Might struggle with necessary boundaries'
      ]
    },
    'Consistency': {
      domain: 'Executing',
      brief: 'People with Consistency are keenly aware of the need to treat people the same. They try to treat everyone fairly by setting up clear rules and adhering to them.',
      full: 'Balance is important to you. You are keenly aware of the need to treat people the same, no matter what their station in life, so you do not want to see the scales tipped too far in any one person\'s favor.',
      quote: 'Everyone should get the same opportunity. I can\'t stand it when people get special treatment just because of who they know.',
      workingWith: [
        'Use them to establish fair processes and policies',
        'Have them monitor for equitable treatment',
        'Partner them with Individualization to balance fairness with personalization'
      ],
      potentialBlindSpots: [
        'May be inflexible when exceptions are needed',
        'Can overlook individual circumstances',
        'Might resist necessary differentiation'
      ]
    },
    'Context': {
      domain: 'Strategic Thinking',
      brief: 'People with Context enjoy thinking about the past. They understand the present by researching its history.',
      full: 'You look back. You look back because that is where the answers lie. You look back to understand the present. From your vantage point the present is unstable, a confusing clamor of competing voices.',
      quote: 'We need to understand how we got here before we decide where to go. History doesn\'t repeat, but it sure does rhyme.',
      workingWith: [
        'Use them to provide context and background',
        'Have them research precedents before major decisions',
        'Partner them with Futuristic to connect past insights with future possibilities'
      ],
      potentialBlindSpots: [
        'May get stuck in "the way things were"',
        'Can resist new approaches',
        'Might over-analyze historical patterns'
      ]
    },
    'Deliberative': {
      domain: 'Executing',
      brief: 'People with Deliberative are best described by the serious care they take in making decisions or choices. They anticipate obstacles.',
      full: 'You are careful. You are vigilant. You are a private person. You know that the world is an unpredictable place. Everything may seem in order, but beneath the surface you sense the many risks.',
      quote: 'Let\'s think this through. What could go wrong? I\'d rather take time now than deal with problems later.',
      workingWith: [
        'Give them time to consider decisions carefully',
        'Use them to identify potential risks and pitfalls',
        'Partner them with Activator to balance caution with action'
      ],
      potentialBlindSpots: [
        'May be seen as overly cautious or negative',
        'Can slow down decision-making',
        'Might miss opportunities that require quick action'
      ]
    },
    'Developer': {
      domain: 'Relationship Building',
      brief: 'Developers recognize and cultivate the potential in others. They spot the signs of each small improvement and derive satisfaction from evidence of progress.',
      full: 'You see the potential in others. Very often, in fact, potential is all you see. In your view no individual is fully formed. On the contrary, each individual is a work in progress, alive with possibilities.',
      quote: 'I love seeing people grow. There\'s nothing more satisfying than watching someone discover what they\'re capable of.',
      workingWith: [
        'Put them in mentoring or coaching roles',
        'Use them to identify and develop talent',
        'Partner them with Maximizer to focus development efforts'
      ],
      potentialBlindSpots: [
        'May see potential where none exists',
        'Can be frustrated when others don\'t want to grow',
        'Might neglect their own development'
      ]
    },
    'Discipline': {
      domain: 'Executing',
      brief: 'People with Discipline enjoy routine and structure. They create order out of chaos.',
      full: 'Your world needs to be predictable. It needs to be ordered and planned. So you instinctively impose structure on your world. You set up routines. You focus on timelines and deadlines.',
      quote: 'I need structure and systems. Without a plan, chaos takes over and nothing gets accomplished.',
      workingWith: [
        'Give them structured environments and clear timelines',
        'Use them to establish processes and procedures',
        'Partner them with Adaptability to balance structure with flexibility'
      ],
      potentialBlindSpots: [
        'May be inflexible when change is needed',
        'Can frustrate those who prefer spontaneity',
        'Might create unnecessary structure'
      ]
    },
    'Empathy': {
      domain: 'Relationship Building',
      brief: 'People with Empathy can sense other people\'s feelings by imagining themselves in their lives or situations.',
      full: 'You can sense the emotions of those around you. You can feel what they are feeling as though their feelings are your own. Intuitively, you are able to see the world through their eyes.',
      quote: 'I can feel what others are feeling. It\'s like I have emotional radar that picks up on the mood in the room.',
      workingWith: [
        'Use them to understand team dynamics and morale',
        'Have them help with difficult conversations',
        'Partner them with Command to balance empathy with decisiveness'
      ],
      potentialBlindSpots: [
        'May take on others\' emotions as their own',
        'Can be paralyzed by others\' distress',
        'Might avoid necessary difficult decisions'
      ]
    },
    'Focus': {
      domain: 'Executing',
      brief: 'People with Focus can take a direction, follow through, and make the corrections necessary to stay on track.',
      full: '"Where am I headed?" you ask yourself. You ask this question every day. Guided by this theme of Focus, you need a clear destination. Lacking one, your life and your work can quickly become frustrating.',
      quote: 'I need to know where we\'re going. Once I have a clear target, I can filter out distractions and stay on course.',
      workingWith: [
        'Give them clear goals and priorities',
        'Use them to keep projects on track',
        'Partner them with Ideation to balance focus with creativity'
      ],
      potentialBlindSpots: [
        'May miss opportunities outside their focus',
        'Can be seen as inflexible or single-minded',
        'Might ignore important but unrelated issues'
      ]
    },
    'Futuristic': {
      domain: 'Strategic Thinking',
      brief: 'People with Futuristic are inspired by the future and what could be. They energize others with their visions of the future.',
      full: '"Wouldn\'t it be great if..." You are the kind of person who loves to peer over the horizon. The future fascinates you. As if it were projected on the wall, you see in detail what the future might hold.',
      quote: 'I can see possibilities that others can\'t. The future isn\'t scary to me - it\'s exciting and full of potential.',
      workingWith: [
        'Use them for strategic planning and vision setting',
        'Have them inspire others with future possibilities',
        'Partner them with Achiever to turn vision into action'
      ],
      potentialBlindSpots: [
        'May lose sight of present realities',
        'Can frustrate those who prefer concrete plans',
        'Might chase too many future possibilities'
      ]
    },
    'Harmony': {
      domain: 'Relationship Building',
      brief: 'People with Harmony look for consensus. They don\'t enjoy conflict; rather, they seek areas of agreement.',
      full: 'You look for areas of agreement. In your view there is little to be gained from conflict and friction, so you seek to hold them to a minimum. When you know that the people around you hold differing views, you try to find the common ground.',
      quote: 'Let\'s find what we can agree on. There has to be a way for everyone to feel heard and valued.',
      workingWith: [
        'Use them to build consensus and resolve conflicts',
        'Have them facilitate discussions between opposing sides',
        'Partner them with Command when decisive action is needed'
      ],
      potentialBlindSpots: [
        'May avoid necessary conflicts',
        'Can compromise too much',
        'Might suppress their own opinions'
      ]
    },
    'Ideation': {
      domain: 'Strategic Thinking',
      brief: 'People with Ideation are fascinated by ideas. They are able to find connections between seemingly disparate phenomena.',
      full: 'You are fascinated by ideas. What is an idea? An idea is a concept, the best explanation of the most events. You are delighted when you discover beneath the complex surface an elegantly simple concept to explain why things are the way they are.',
      quote: 'What if we tried this completely different approach? I love connecting dots that others don\'t see.',
      workingWith: [
        'Use them in brainstorming sessions and creative problem solving',
        'Give them time to explore and develop ideas',
        'Partner them with Focus or Discipline to turn ideas into action'
      ],
      potentialBlindSpots: [
        'May get excited by ideas but not follow through',
        'Can overwhelm others with too many concepts',
        'Might pursue impractical or unrealistic ideas'
      ]
    },
    'Includer': {
      domain: 'Relationship Building',
      brief: 'Includers want to include people and make them feel part of the group. They are accepting of others.',
      full: '"Stretch the circle wider." This is the philosophy around which you orient your life. You want to include people, not exclude them. You see the group as the instrument of great power.',
      quote: 'Everyone has something to contribute. I make sure no one gets left out or overlooked.',
      workingWith: [
        'Use them to build inclusive teams and environments',
        'Have them help integrate new team members',
        'Partner them with Focus to balance inclusion with efficiency'
      ],
      potentialBlindSpots: [
        'May include people who shouldn\'t be included',
        'Can slow down processes to ensure everyone is involved',
        'Might avoid necessary exclusions'
      ]
    },
    'Individualization': {
      domain: 'Relationship Building',
      brief: 'People with Individualization are intrigued with the unique qualities of each person. They have a gift for figuring out how different people can work together productively.',
      full: 'Your Individualization theme leads you to be intrigued by the unique qualities of each person. You are impatient with generalizations or "types" because you don\'t want to obscure what is special and distinct about each person.',
      quote: 'I see what makes each person unique. Cookie-cutter approaches just don\'t work with people.',
      workingWith: [
        'Use them to customize approaches for different team members',
        'Have them help with team composition and role assignments',
        'Partner them with Consistency to balance personalization with fairness'
      ],
      potentialBlindSpots: [
        'May spend too much time customizing approaches',
        'Can be seen as playing favorites',
        'Might resist necessary standardization'
      ]
    },
    'Input': {
      domain: 'Strategic Thinking',
      brief: 'People with Input have a craving to know more. Often they like to collect and archive all kinds of information.',
      full: 'Your craving to know more is the key to your Input theme. More than anything else you want to be informed. You always want to know more. You crave information.',
      quote: 'I need to gather all the information before I can make a good decision. Knowledge is never wasted.',
      workingWith: [
        'Give them access to information and resources',
        'Use them as a research resource for the team',
        'Partner them with Focus to help prioritize information gathering'
      ],
      potentialBlindSpots: [
        'May hoard information instead of sharing it',
        'Can get overwhelmed by too much information',
        'Might delay decisions while gathering more data'
      ]
    },
    'Intellection': {
      domain: 'Strategic Thinking',
      brief: 'People with Intellection are characterized by their intellectual activity. They are introspective and appreciate intellectual discussions.',
      full: 'You like to think. You like mental activity. You like exercising the "muscles" of your brain, stretching them in multiple directions. This need for mental activity may be focused; for example, you may be trying to solve a problem or develop an idea or understand another person\'s feelings.',
      quote: 'I need time to think things through. My best insights come when I can reflect deeply on complex issues.',
      workingWith: [
        'Give them time to think before expecting responses',
        'Use them to analyze complex problems and situations',
        'Partner them with Activator to move from thinking to action'
      ],
      potentialBlindSpots: [
        'May overthink things and delay action',
        'Can be seen as slow or indecisive',
        'Might get lost in abstract thinking'
      ]
    },
    'Learner': {
      domain: 'Strategic Thinking',
      brief: 'People with Learner have a great desire to learn and want to continuously improve. The process of learning, rather than the outcome, excites them.',
      full: 'You love to learn. The subject matter that interests you most will be determined by your other themes and experiences, but whatever the subject, you will always be drawn to the process of learning.',
      quote: 'I\'m energized by learning new things. It doesn\'t matter what it is - the process of getting better excites me.',
      workingWith: [
        'Provide opportunities for continuous learning and development',
        'Use them to research new methods and approaches',
        'Partner them with Achiever to channel learning into accomplishment'
      ],
      potentialBlindSpots: [
        'May jump from learning to learning without mastering anything',
        'Can be seen as unfocused or dabbling',
        'Might prioritize learning over performing'
      ]
    },
    'Maximizer': {
      domain: 'Influencing',
      brief: 'People with Maximizer focus on strengths as a way to stimulate personal and group excellence. They seek to transform something strong into something superb.',
      full: 'Excellence, not average, is your measure. Taking something from below average to slightly above average takes a great deal of effort and in your opinion is not very rewarding. Transforming something strong into something superb takes just as much effort but is much more thrilling.',
      quote: 'Why waste time on weaknesses? Let\'s take what we\'re already good at and make it exceptional.',
      workingWith: [
        'Focus on leveraging and developing strengths',
        'Use them to help others identify and build on their talents',
        'Partner them with Developer to balance excellence with growth'
      ],
      potentialBlindSpots: [
        'May ignore important weaknesses that need attention',
        'Can be impatient with those who focus on fixing problems',
        'Might create unrealistic standards for excellence'
      ]
    },
    'Positivity': {
      domain: 'Relationship Building',
      brief: 'People with Positivity have contagious enthusiasm. They are upbeat and can get others excited about what they are going to do.',
      full: 'You are generous with praise, quick to smile, and always on the lookout for the positive in the situation. Some call you lighthearted. Others just wish that their glass were as full as yours seems to be.',
      quote: 'I choose to see the bright side. Life\'s too short to dwell on the negative when there\'s so much good around us.',
      workingWith: [
        'Use them to boost team morale and energy',
        'Have them help reframe challenges in positive ways',
        'Partner them with Analytical to balance optimism with realism'
      ],
      potentialBlindSpots: [
        'May ignore real problems or difficulties',
        'Can be seen as naive or unrealistic',
        'Might frustrate those who need to process negative emotions'
      ]
    },
    'Relator': {
      domain: 'Relationship Building',
      brief: 'People with Relator enjoy close relationships with others. They find deep satisfaction in working hard with friends to achieve a goal.',
      full: 'Relator describes your attitude toward your relationships. In simple terms, the Relator theme pulls you toward people you already know. You do not necessarily shy away from meeting new people—in fact, you may have other themes that cause you to enjoy the thrill of turning strangers into friends—but you do derive a great deal of pleasure and strength from being around your close friends.',
      quote: 'I work best with people I know and trust. Deep relationships are more valuable than wide networks.',
      workingWith: [
        'Give them opportunities to work closely with familiar colleagues',
        'Use them to deepen relationships within the team',
        'Partner them with Woo to balance depth with breadth in relationships'
      ],
      potentialBlindSpots: [
        'May be slow to trust or connect with new people',
        'Can create "inner circles" that exclude others',
        'Might resist necessary changes in team composition'
      ]
    },
    'Responsibility': {
      domain: 'Executing',
      brief: 'People with Responsibility take psychological ownership of what they say they will do. They are committed to stable values such as dependability.',
      full: 'Your Responsibility theme forces you to take psychological ownership for anything you commit to, and whether large or small, you feel emotionally bound to follow it through to completion.',
      quote: 'When I say I\'ll do something, I do it. My word is my bond, and people know they can count on me.',
      workingWith: [
        'Give them clear commitments and deadlines',
        'Use them for important follow-through responsibilities',
        'Partner them with Strategic to ensure they\'re taking on the right commitments'
      ],
      potentialBlindSpots: [
        'May take on too much responsibility',
        'Can be reluctant to delegate important tasks',
        'Might feel guilty when they can\'t fulfill every commitment'
      ]
    },
    'Restorative': {
      domain: 'Executing',
      brief: 'People with Restorative are adept at dealing with problems. They are good at figuring out what is wrong and resolving it.',
      full: 'You love to solve problems. Whereas some are dismayed when they encounter yet another breakdown, you can be energized by it. You enjoy the challenge of analyzing the symptoms, identifying what is wrong, and finding the solution.',
      quote: 'I\'m energized by fixing what\'s broken. Give me a problem and I\'ll find a way to solve it.',
      workingWith: [
        'Use them to troubleshoot problems and implement solutions',
        'Give them challenging situations that need fixing',
        'Partner them with Strategic to ensure solutions align with long-term goals'
      ],
      potentialBlindSpots: [
        'May focus too much on problems instead of opportunities',
        'Can be seen as negative or critical',
        'Might jump to solutions without understanding root causes'
      ]
    },
    'Self-Assurance': {
      domain: 'Influencing',
      brief: 'People with Self-Assurance feel confident in their ability to manage their own lives. They possess an inner compass that gives them confidence that their decisions are right.',
      full: 'Self-Assurance is similar to self-confidence. In the deepest part of you, you have faith in your strengths. You know that you are able—able to take risks, able to meet new challenges, able to stake claims, and, most important, able to deliver.',
      quote: 'I trust my instincts. I know I can handle whatever comes my way, even if I\'ve never done it before.',
      workingWith: [
        'Give them autonomy and independence in their work',
        'Use them in situations requiring confidence and risk-taking',
        'Partner them with Input to ensure their confidence is based on good information'
      ],
      potentialBlindSpots: [
        'May appear arrogant or dismissive of others\' input',
        'Can be resistant to feedback or coaching',
        'Might take on too much risk without adequate preparation'
      ]
    },
    'Significance': {
      domain: 'Influencing',
      brief: 'People with Significance want to be very important in the eyes of others. They are independent and want to be recognized.',
      full: 'You want to be very significant in the eyes of other people. In the truest sense of the word you want to be recognized. You feel a need to be known, and in particular you want to be known and appreciated for the unique strengths you bring.',
      quote: 'I want my work to matter and be recognized. I need to know that what I do makes a real difference.',
      workingWith: [
        'Recognize their contributions publicly and meaningfully',
        'Give them high-visibility projects and responsibilities',
        'Partner them with Harmony to balance recognition-seeking with team needs'
      ],
      potentialBlindSpots: [
        'May seek recognition at the expense of team success',
        'Can be frustrated when their contributions go unnoticed',
        'Might avoid tasks that don\'t bring visibility'
      ]
    },
    'Strategic': {
      domain: 'Strategic Thinking',
      brief: 'People with Strategic create alternative ways to proceed. They can quickly spot patterns and issues.',
      full: 'The Strategic theme enables you to sort through the clutter and find the best route. It is not a skill that can be taught. It is a distinct way of thinking, a special perspective on the world at large.',
      quote: 'I can see three different ways we could approach this. Let me walk you through the pros and cons of each path.',
      workingWith: [
        'Involve them early in planning processes',
        'Use them to find alternative solutions',
        'Partner them with Achiever to ensure strategies get implemented'
      ],
      potentialBlindSpots: [
        'May overcomplicate simple situations',
        'Can frustrate those who want one clear path',
        'Might get stuck in planning mode'
      ]
    },
    'Woo': {
      domain: 'Influencing',
      brief: 'People with Woo love the challenge of meeting new people and winning them over. They derive satisfaction from breaking the ice.',
      full: 'Woo stands for winning others over. You enjoy the challenge of meeting new people and getting them to like you. Strangers are rarely intimidating to you. On the contrary, strangers can be energizing.',
      quote: 'I love meeting new people and making connections. There\'s nothing like the energy of turning a stranger into a friend.',
      workingWith: [
        'Use them in networking and relationship-building roles',
        'Have them help with team building and social events',
        'Partner them with Relator to balance breadth with depth in relationships'
      ],
      potentialBlindSpots: [
        'May struggle to maintain all the relationships they create',
        'Can be seen as superficial or insincere',
        'Might prioritize making new connections over deepening existing ones'
      ]
    }
  };

  // Check for strength parameter in URL and open modal automatically
  useEffect(() => {
    const path = window.location.pathname;
    const strengthMatch = path.match(/\/encyclopedia\/(.+)/);
    
    if (strengthMatch) {
      const strengthName = decodeURIComponent(strengthMatch[1]);
      if (strengthsData[strengthName]) {
        setSelectedStrength({ name: strengthName, ...strengthsData[strengthName] });
        setIsModalOpen(true);
      }
    }
  }, []);

  const getDomainColor = (domain: string) => {
    const colors: Record<string, string> = {
      'Executing': 'var(--executing)',
      'Influencing': 'var(--influencing)',
      'Relationship Building': 'var(--relationship)',
      'Strategic Thinking': 'var(--strategic)'
    };
    return colors[domain] || 'var(--accent-blue)';
  };

  const getDomainClass = (domain: string) => {
    const classes: Record<string, string> = {
      'Executing': 'executing',
      'Influencing': 'influencing', 
      'Relationship Building': 'relationship',
      'Strategic Thinking': 'strategic'
    };
    return classes[domain] || 'strategic';
  };

  const filteredStrengths = Object.entries(strengthsData).filter(([name, data]) => {
    const matchesSearch = !searchTerm || 
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      data.brief.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === 'all' || getDomainClass(data.domain) === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const openModal = (name: string, data: any) => {
    setSelectedStrength({ name, ...data });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedStrength(null);
    setLocation('/dashboard');
  };

  return (
    <>
      <Navigation />
      <div className="main-content">
        <div className="page-header">
          <h1>CliftonStrengths Encyclopedia</h1>
          <p>Explore all 34 talent themes and discover how to leverage them for success</p>
        </div>

        {/* Search and Filter Controls */}
        <div className="controls-section">
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search for a strength by name or keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="domain-filters">
            <button 
              className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All Strengths
            </button>
            <button 
              className={`filter-btn ${activeFilter === 'executing' ? 'active' : ''}`}
              onClick={() => setActiveFilter('executing')}
            >
              <span className="domain-dot" style={{background: 'var(--executing)'}}></span>
              Executing
            </button>
            <button 
              className={`filter-btn ${activeFilter === 'influencing' ? 'active' : ''}`}
              onClick={() => setActiveFilter('influencing')}
            >
              <span className="domain-dot" style={{background: 'var(--influencing)'}}></span>
              Influencing
            </button>
            <button 
              className={`filter-btn ${activeFilter === 'relationship' ? 'active' : ''}`}
              onClick={() => setActiveFilter('relationship')}
            >
              <span className="domain-dot" style={{background: 'var(--relationship)'}}></span>
              Relationship Building
            </button>
            <button 
              className={`filter-btn ${activeFilter === 'strategic' ? 'active' : ''}`}
              onClick={() => setActiveFilter('strategic')}
            >
              <span className="domain-dot" style={{background: 'var(--strategic)'}}></span>
              Strategic Thinking
            </button>
          </div>
        </div>

        {/* Strengths Grid */}
        <div className="strengths-grid">
          {filteredStrengths.map(([name, data]) => (
            <div 
              key={name} 
              className={`strength-card ${getDomainClass(data.domain)}`}
              onClick={() => openModal(name, data)}
            >
              <div className="strength-header">
                <h3 className="strength-title">{name}</h3>
                <div className="strength-domain">
                  <span className="domain-dot" style={{background: getDomainColor(data.domain)}}></span>
                  {data.domain}
                </div>
              </div>
              <p className="strength-description">{data.brief}</p>
              <div className="strength-quote">"{data.quote}"</div>
            </div>
          ))}
        </div>

        {filteredStrengths.length === 0 && (
          <div className="loading">No strengths found matching your criteria.</div>
        )}
      </div>

      {/* Strength Detail Modal */}
      {isModalOpen && selectedStrength && (
        <div className="modal active" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={closeModal}>&times;</button>
            <div className="modal-header">
              <h2 className="modal-title">{selectedStrength.name}</h2>
              <div className="modal-domain">
                <span className="domain-dot" style={{background: getDomainColor(selectedStrength.domain)}}></span>
                {selectedStrength.domain}
              </div>
            </div>
            
            <p className="modal-description">{selectedStrength.full}</p>
            
            <div className="modal-section">
              <h3>Working with {selectedStrength.name}</h3>
              <ul>
                {selectedStrength.workingWith?.map((tip: string, index: number) => (
                  <li key={index}>{tip}</li>
                ))}
              </ul>
            </div>
            
            <div className="modal-section">
              <h3>Potential Blind Spots</h3>
              <ul>
                {selectedStrength.potentialBlindSpots?.map((spot: string, index: number) => (
                  <li key={index}>{spot}</li>
                ))}
              </ul>
            </div>
            
            <div className="modal-section">
              <div className="strength-quote" style={{margin: 0}}>
                "{selectedStrength.quote}"
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Encyclopedia;
