// Domain verification setup for Resend
import { Resend } from 'resend';

async function setupDomainVerification() {
  console.log('Setting up domain verification for production email delivery...');
  
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    // Check current domains
    console.log('1. Checking current domain configuration...');
    const domains = await resend.domains.list();
    console.log('Current domains:', domains.data);
    
    if (domains.data && domains.data.length > 0) {
      console.log('\n📧 Existing domains found:');
      domains.data.forEach(domain => {
        console.log(`- ${domain.name}: ${domain.status}`);
        console.log(`  ID: ${domain.id}`);
        console.log(`  Region: ${domain.region}`);
        console.log(`  Created: ${domain.created_at}`);
        if (domain.status === 'verified') {
          console.log(`  ✅ Verified domain: ${domain.name}`);
          console.log(`  📤 You can send from: *@${domain.name}`);
        } else {
          console.log(`  ⚠️  Status: ${domain.status}`);
        }
      });
      
      // Get detailed domain verification info
      console.log('\n🔍 Checking domain verification details...');
      for (const domain of domains.data) {
        try {
          const details = await resend.domains.get(domain.id);
          console.log(`\nDomain: ${domain.name}`);
          console.log('DNS Records:', details.records);
          console.log('Status:', details.status);
        } catch (error) {
          console.log(`Error getting details for ${domain.name}:`, error.message);
        }
      }
    } else {
      console.log('\n⚠️  No domains configured yet');
    }
    
    // Check current sender configuration
    console.log('\n2. Current email sender configuration:');
    console.log('From address: onboarding@resend.dev (testing mode)');
    console.log('Restriction: Can only send to tinymanagerai@gmail.com');
    
    console.log('\n🔧 To enable production mode:');
    console.log('1. Add a domain you own to Resend');
    console.log('2. Verify domain ownership via DNS records');
    console.log('3. Update from address to use verified domain');
    
    console.log('\n📋 Next steps:');
    console.log('- Visit https://resend.com/domains');
    console.log('- Add your domain (e.g., yourdomain.com)');
    console.log('- Add the DNS records provided by Resend');
    console.log('- Once verified, update the from address in emailService.ts');
    
    return { success: true, domains: domains.data };
    
  } catch (error) {
    console.error('Error checking domain configuration:', error);
    return { success: false, error: error.message };
  }
}

// Run domain verification check
setupDomainVerification()
  .then(result => {
    if (result.success) {
      console.log('\n✅ Domain verification check complete');
    } else {
      console.log('\n❌ Domain verification check failed:', result.error);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });