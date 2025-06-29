// Simple script to set up admin user
// Run this after the user has signed up with tinymanagerai@gmail.com

const setupAdmin = async () => {
  try {
    const response = await fetch('/api/admin/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'tinymanagerai@gmail.com'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Admin setup successful:', result.message);
    } else {
      const error = await response.json();
      console.error('❌ Admin setup failed:', error.error);
    }
  } catch (error) {
    console.error('❌ Admin setup error:', error);
  }
};

// Instructions for use:
console.log('📋 Admin Setup Instructions:');
console.log('1. Sign up/login with tinymanagerai@gmail.com');
console.log('2. Open browser console on any page');
console.log('3. Copy and paste this script:');
console.log('4. Run: setupAdmin()');
console.log('');
console.log('Or visit: /api/admin/setup with POST request containing:');
console.log('{ "email": "tinymanagerai@gmail.com" }'); 