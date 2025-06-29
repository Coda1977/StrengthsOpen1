import https from 'https';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const DOMAIN = 'tinymanager.ai';

function checkDomainStatus() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.resend.com',
      path: `/domains/${DOMAIN}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('\n=== DOMAIN STATUS ===');
          console.log(`Domain: ${response.name || DOMAIN}`);
          console.log(`Status: ${response.status || 'Unknown'}`);
          console.log(`Region: ${response.region || 'Unknown'}`);
          console.log(`Created: ${response.created_at || 'Unknown'}`);
          
          if (response.records) {
            console.log('\n=== DNS RECORDS STATUS ===');
            response.records.forEach(record => {
              console.log(`${record.record_type} ${record.name || '@'}: ${record.status || 'Unknown'}`);
            });
          }
          
          resolve(response);
        } catch (error) {
          console.error('Error parsing response:', error);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });

    req.end();
  });
}

async function main() {
  try {
    console.log('Checking domain verification status...');
    await checkDomainStatus();
  } catch (error) {
    console.error('Failed to check domain status:', error);
    process.exit(1);
  }
}

main();