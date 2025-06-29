import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function checkDomainStatus() {
  try {
    console.log('Checking domain verification status...');
    const domain = await resend.domains.get('tinymanager.ai');
    console.log('\n=== DOMAIN STATUS ===');
    console.log(`Domain: ${domain.name}`);
    console.log(`Status: ${domain.status}`);
    console.log(`Region: ${domain.region}`);
    
    if (domain.records) {
      console.log('\n=== DNS RECORDS STATUS ===');
      domain.records.forEach(record => {
        console.log(`${record.record_type} ${record.name || '@'}: ${record.status}`);
      });
    }
    
    return domain.status === 'verified';
  } catch (error) {
    console.error('Domain check error:', error.message);
    return false;
  }
}

async function testEmail() {
  try {
    console.log('\n=== TESTING EMAIL DELIVERY ===');
    
    const { data, error } = await resend.emails.send({
      from: 'onboarding@tinymanager.ai',
      to: ['tinymanagerai@gmail.com'],
      subject: 'Domain Verification Test - tinymanager.ai',
      html: `
        <h2>Domain Verification Successful!</h2>
        <p>This email confirms that tinymanager.ai is now verified and ready for production email delivery.</p>
        <p><strong>Test completed:</strong> ${new Date().toISOString()}</p>
        <p>All welcome emails and coaching emails will now be delivered directly to recipients.</p>
      `
    });

    if (error) {
      console.error('Email send error:', error);
      return false;
    }

    console.log('✅ Email sent successfully!');
    console.log(`Email ID: ${data.id}`);
    return true;
  } catch (error) {
    console.error('Email test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('='.repeat(50));
  console.log('DOMAIN & EMAIL VERIFICATION TEST');
  console.log('='.repeat(50));
  
  const domainVerified = await checkDomainStatus();
  
  if (domainVerified) {
    console.log('\n✅ Domain is VERIFIED - testing email delivery...');
    const emailWorking = await testEmail();
    
    if (emailWorking) {
      console.log('\n🎉 SUCCESS! Email system is fully operational!');
      console.log('- Domain verified');
      console.log('- Email delivery working');
      console.log('- Ready for production use');
    } else {
      console.log('\n❌ Domain verified but email delivery failed');
    }
  } else {
    console.log('\n⏳ Domain verification still pending...');
    console.log('DNS records may need more time to propagate (up to 30 minutes)');
  }
}

main().catch(console.error);