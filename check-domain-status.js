// Check current domain status and get verification details
import { Resend } from 'resend';

async function checkDomainStatus() {
  console.log('Checking domain status and verification requirements...');
  
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    // List all domains
    const domains = await resend.domains.list();
    console.log('All domains:', JSON.stringify(domains, null, 2));
    
    if (domains.data && domains.data.length > 0) {
      for (const domain of domains.data) {
        console.log(`\nChecking domain: ${domain.name} (Status: ${domain.status})`);
        
        try {
          const details = await resend.domains.get(domain.id);
          console.log('Domain details:', JSON.stringify(details, null, 2));
          
          if (details.records) {
            console.log(`\nDNS Records needed for ${domain.name}:`);
            details.records.forEach((record, index) => {
              console.log(`${index + 1}. Type: ${record.type}`);
              console.log(`   Name: ${record.name}`);
              console.log(`   Value: ${record.value}`);
              if (record.priority) console.log(`   Priority: ${record.priority}`);
            });
          }
        } catch (detailError) {
          console.log(`Error getting details for ${domain.name}:`, detailError.message);
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking domains:', error);
  }
}

checkDomainStatus()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Check failed:', error);
    process.exit(1);
  });