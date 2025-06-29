// Get DNS records for domain verification
import { Resend } from 'resend';

async function getDNSRecords() {
  console.log('Retrieving DNS records for domain verification...');
  
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    // Get domain details
    const domainId = '5d8f63c5-fcc4-4ce8-9bba-ea8db64e68e8'; // From previous response
    const domainDetails = await resend.domains.get(domainId);
    
    console.log('\n=== DNS RECORDS TO ADD TO tinymanager.ai ===\n');
    
    if (domainDetails.records) {
      domainDetails.records.forEach((record, index) => {
        console.log(`Record ${index + 1}:`);
        console.log(`Type: ${record.type}`);
        console.log(`Name: ${record.name}`);
        console.log(`Value: ${record.value}`);
        if (record.priority) console.log(`Priority: ${record.priority}`);
        console.log('---');
      });
      
      console.log('\nInstructions:');
      console.log('1. Log into your DNS provider (where tinymanager.ai is hosted)');
      console.log('2. Add the above DNS records exactly as shown');
      console.log('3. Wait for DNS propagation (usually 5-30 minutes)');
      console.log('4. Domain will automatically verify once DNS is active');
      
      console.log('\nOnce verified, emails can be sent from: anything@tinymanager.ai');
      
    } else {
      console.log('No DNS records found');
    }
    
  } catch (error) {
    console.error('Error retrieving DNS records:', error);
  }
}

getDNSRecords()
  .then(() => {
    console.log('\nDNS records retrieved successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed to get DNS records:', error);
    process.exit(1);
  });