// Initiate domain verification and get DNS records
import { Resend } from 'resend';

async function verifyDomain() {
  console.log('Initiating domain verification for tinymanager.ai...');
  
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const domainId = '5d8f63c5-fcc4-4ce8-9bba-ea8db64e68e8';
    
    // Try to verify the domain to trigger DNS record generation
    try {
      const verifyResult = await resend.domains.verify(domainId);
      console.log('Verification initiated:', verifyResult);
    } catch (verifyError) {
      console.log('Verification trigger failed:', verifyError.message);
    }
    
    // Get updated domain details
    const details = await resend.domains.get(domainId);
    console.log('\nDomain verification status:', details.status);
    
    if (details.records && details.records.length > 0) {
      console.log('\n=== ADD THESE DNS RECORDS TO tinymanager.ai ===');
      details.records.forEach((record, index) => {
        console.log(`\n${index + 1}. ${record.type} Record:`);
        console.log(`   Host/Name: ${record.name}`);
        console.log(`   Value: ${record.value}`);
        if (record.priority) console.log(`   Priority: ${record.priority}`);
        console.log(`   TTL: ${record.ttl || '3600'}`);
      });
      
      console.log('\n=== INSTRUCTIONS ===');
      console.log('1. Go to your domain registrar/DNS provider for tinymanager.ai');
      console.log('2. Add each DNS record exactly as shown above');
      console.log('3. Save the DNS changes');
      console.log('4. Wait 5-30 minutes for DNS propagation');
      console.log('5. Resend will automatically verify the domain');
      console.log('\nOnce verified, you can send emails from any @tinymanager.ai address');
      
    } else {
      console.log('No DNS records available yet. Domain may need manual setup.');
      
      // Try creating verification records manually
      console.log('Attempting to generate verification records...');
      
      // Standard DNS records needed for email sending
      console.log('\n=== STANDARD EMAIL DNS RECORDS ===');
      console.log('Add these records to tinymanager.ai DNS:');
      console.log('\n1. SPF Record (TXT):');
      console.log('   Host: @');
      console.log('   Value: v=spf1 include:_spf.resend.com ~all');
      console.log('\n2. DKIM Record (TXT):');
      console.log('   Host: resend._domainkey');
      console.log('   Value: [Will be provided by Resend after domain addition]');
      console.log('\n3. DMARC Record (TXT):');
      console.log('   Host: _dmarc');
      console.log('   Value: v=DMARC1; p=none; rua=mailto:dmarc@tinymanager.ai');
    }
    
  } catch (error) {
    console.error('Domain verification setup failed:', error);
  }
}

verifyDomain()
  .then(() => {
    console.log('\nDomain verification process initiated');
    process.exit(0);
  })
  .catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });