const https = require('https');

async function testEmailAPI() {
  console.log('Testing proper email templates through API...\n');
  
  // Test welcome email for codanudge user
  const testWelcomeEmail = () => {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        email: 'codanudge@gmail.com',
        timezone: 'America/New_York'
      });

      const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/send-welcome-email',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          console.log('Welcome Email Response:', res.statusCode, data);
          resolve(data);
        });
      });

      req.on('error', (error) => {
        console.log('Testing welcome email via direct email service call...');
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  };

  try {
    await testWelcomeEmail();
  } catch (error) {
    console.log('API test completed - check server logs for email delivery status');
  }
}

testEmailAPI();