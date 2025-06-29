#!/usr/bin/env node

// Debug script to test weekly email content generation
// This tests the AI content generation without sending actual emails

const { generateWeeklyEmailContent } = require('./server/openai');

async function testWeeklyEmailGeneration() {
  console.log('🧪 Testing Weekly Email Content Generation');
  console.log('==========================================');
  
  try {
    // Test data for a manager
    const testData = {
      managerName: 'Sarah',
      topStrengths: ['Strategic', 'Achiever', 'Developer', 'Focus', 'Relator'],
      weekNumber: 1,
      teamSize: 6,
      featuredStrength: 'Strategic',
      featuredTeamMember: 'Alex',
      teamMemberStrengths: ['Analytical', 'Focus', 'Responsibility'],
      teamMemberFeaturedStrength: 'Analytical',
      previousPersonalTips: [], // First week
      previousOpeners: [], // First week
      previousTeamMembers: [] // First week
    };

    console.log('Input Data:');
    console.log('- Manager:', testData.managerName);
    console.log('- Strengths:', testData.topStrengths.join(', '));
    console.log('- Week:', testData.weekNumber);
    console.log('- Featured Strength:', testData.featuredStrength);
    console.log('- Team Member:', testData.featuredTeamMember);
    console.log('- Team Member Strength:', testData.teamMemberFeaturedStrength);
    console.log('\nGenerating content...\n');

    const weeklyContent = await generateWeeklyEmailContent(
      testData.managerName,
      testData.topStrengths,
      testData.weekNumber,
      testData.teamSize,
      testData.featuredStrength,
      testData.featuredTeamMember,
      testData.teamMemberStrengths,
      testData.teamMemberFeaturedStrength,
      testData.previousPersonalTips,
      testData.previousOpeners,
      testData.previousTeamMembers
    );

    console.log('✅ GENERATED CONTENT:');
    console.log('=====================');
    console.log(`📧 Subject Line (${weeklyContent.subjectLine.length}/45 chars): "${weeklyContent.subjectLine}"`);
    console.log(`📋 Pre-header (${weeklyContent.preHeader.length} chars): "${weeklyContent.preHeader}"`);
    console.log(`🎯 Header: "${weeklyContent.header}"`);
    console.log(`💡 Personal Insight: "${weeklyContent.personalInsight}"`);
    console.log(`🛠️ Technique: "${weeklyContent.techniqueName}"`);
    console.log(`📖 Technique Content: "${weeklyContent.techniqueContent}"`);
    console.log(`👥 Team Section: "${weeklyContent.teamSection}"`);
    console.log(`💬 Quote: "${weeklyContent.quote}" - ${weeklyContent.quoteAuthor}`);

    // Validate compliance with your requirements
    console.log('\n🔍 VALIDATION CHECKS:');
    console.log('=====================');
    
    const checks = [
      {
        name: 'Subject line ≤45 chars',
        pass: weeklyContent.subjectLine.length <= 45,
        actual: weeklyContent.subjectLine.length
      },
      {
        name: 'Pre-header 40-50 chars',
        pass: weeklyContent.preHeader.length >= 40 && weeklyContent.preHeader.length <= 50,
        actual: weeklyContent.preHeader.length
      },
      {
        name: 'Contains typography symbols',
        pass: /[►▶✓✗★]/.test(weeklyContent.techniqueContent + weeklyContent.teamSection),
        actual: 'Checking for ►▶✓✗★'
      },
      {
        name: 'Team section has opener pattern',
        pass: weeklyContent.teamSection.includes('▶') || weeklyContent.teamSection.includes('This week:'),
        actual: 'Looking for team opener'
      },
      {
        name: 'All required fields present',
        pass: Object.keys(weeklyContent).length === 9,
        actual: `${Object.keys(weeklyContent).length}/9 fields`
      }
    ];

    checks.forEach(check => {
      const status = check.pass ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${check.actual}`);
    });

    const allPassed = checks.every(check => check.pass);
    console.log(`\n${allPassed ? '🎉' : '⚠️'} Overall: ${allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}`);

    if (allPassed) {
      console.log('\n✨ The weekly email content generation is working correctly!');
      console.log('💌 Content follows your exact AI instructions and specifications.');
    } else {
      console.log('\n🔧 Some requirements need adjustment in the AI generation.');
    }

  } catch (error) {
    console.error('❌ Error testing weekly email generation:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testWeeklyEmailGeneration().then(() => {
  console.log('\n📋 Test completed.');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});