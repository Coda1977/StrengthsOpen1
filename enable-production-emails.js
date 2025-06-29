// Enable production email delivery
import { Resend } from 'resend';

async function enableProductionEmails() {
  console.log('Enabling production email delivery...');
  
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    // Option 1: Check if we can add a simple domain
    console.log('Checking account limits and options...');
    
    // Get account info
    const domains = await resend.domains.list();
    console.log('Current domains:', domains.data?.length || 0);
    
    // Try adding a simple domain for verification
    const domainToAdd = 'tinymanager.ai'; // Parent domain
    
    console.log(`Attempting to add domain: ${domainToAdd}`);
    try {
      const newDomain = await resend.domains.create({
        name: domainToAdd,
        region: 'us-east-1' // Use US region for better performance
      });
      
      console.log('Domain added successfully:', newDomain);
      console.log('DNS Records to add:');
      if (newDomain.records) {
        newDomain.records.forEach(record => {
          console.log(`${record.type}: ${record.name} -> ${record.value}`);
          console.log(`  Priority: ${record.priority || 'N/A'}`);
        });
        
        console.log('\nDetailed DNS Configuration:');
        newDomain.records.forEach((record, index) => {
          console.log(`\nRecord ${index + 1}:`);
          console.log(`  Type: ${record.type}`);
          console.log(`  Name: ${record.name}`);
          console.log(`  Value: ${record.value}`);
          if (record.priority) console.log(`  Priority: ${record.priority}`);
          if (record.ttl) console.log(`  TTL: ${record.ttl}`);
        });
      }
      
    } catch (domainError) {
      console.log('Domain addition failed:', domainError.message);
      
      // Alternative: Check if we can use existing verified domains
      console.log('Checking for any verified domains...');
      if (domains.data) {
        const verifiedDomains = domains.data.filter(d => d.status === 'verified');
        if (verifiedDomains.length > 0) {
          console.log('Found verified domains:', verifiedDomains);
        } else {
          console.log('No verified domains found');
        }
      }
    }
    
    // Test current sending capabilities
    console.log('\nTesting current email capabilities...');
    try {
      const testResult = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: ['tinymanagerai@gmail.com'],
        subject: 'Production Email Test',
        html: '<p>Testing production email capabilities</p>'
      });
      
      console.log('Test email sent successfully:', testResult.id);
      console.log('Current setup can send to verified addresses');
      
    } catch (sendError) {
      console.log('Test email failed:', sendError.message);
    }
    
    console.log('\nProduction Email Options:');
    console.log('1. Verify domain DNS records if domain was added above');
    console.log('2. Use current setup with sending restrictions');
    console.log('3. Upgrade Resend plan for higher limits');
    
  } catch (error) {
    console.error('Error enabling production emails:', error);
  }
}

enableProductionEmails()
  .then(() => {
    console.log('\nProduction email analysis complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Analysis failed:', error);
    process.exit(1);
  });