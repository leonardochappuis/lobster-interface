#!/usr/bin/env node

// Simple script to test TMDB API credentials
// Usage: node test-tmdb-api.js

const config = require('./config.js');
const axios = require('axios');

console.log('🎬 Testing TMDB API Credentials...\n');

// Test with Bearer Token (current method)
async function testBearerToken() {
  try {
    console.log('Testing Bearer Token authentication...');
    const response = await axios.get(`${config.TMDB_BASE_URL}/movie/popular`, {
      headers: {
        Authorization: `Bearer ${config.TMDB_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: { page: 1 }
    });
    
    console.log('✅ Bearer Token: SUCCESS');
    console.log(`   📊 Found ${response.data.results.length} popular movies`);
    console.log(`   🎬 First movie: "${response.data.results[0].title}"`);
    return true;
  } catch (error) {
    console.log('❌ Bearer Token: FAILED');
    if (error.response) {
      console.log(`   💥 Error: ${error.response.status} - ${error.response.data.status_message}`);
    } else {
      console.log(`   💥 Error: ${error.message}`);
    }
    return false;
  }
}

// Test with API Key (alternative method)
async function testApiKey() {
  try {
    console.log('\nTesting API Key authentication...');
    const response = await axios.get(`${config.TMDB_BASE_URL}/movie/popular`, {
      params: { 
        api_key: config.TMDB_API_KEY,
        page: 1 
      }
    });
    
    console.log('✅ API Key: SUCCESS');
    console.log(`   📊 Found ${response.data.results.length} popular movies`);
    console.log(`   🎬 First movie: "${response.data.results[0].title}"`);
    return true;
  } catch (error) {
    console.log('❌ API Key: FAILED');
    if (error.response) {
      console.log(`   💥 Error: ${error.response.status} - ${error.response.data.status_message}`);
    } else {
      console.log(`   💥 Error: ${error.message}`);
    }
    return false;
  }
}

// Run tests
async function runTests() {
  console.log('Current config values:');
  console.log(`   🔑 API Key: ${config.TMDB_API_KEY.substring(0, 10)}...`);
  console.log(`   🎫 Token: ${config.TMDB_API_TOKEN.substring(0, 20)}...`);
  console.log('');

  const bearerSuccess = await testBearerToken();
  const apiKeySuccess = await testApiKey();

  console.log('\n' + '='.repeat(50));
  
  if (bearerSuccess || apiKeySuccess) {
    console.log('🎉 SUCCESS: At least one authentication method works!');
    if (bearerSuccess) {
      console.log('   Your Bearer Token is working correctly.');
    }
    if (apiKeySuccess) {
      console.log('   Your API Key is working correctly.');
    }
    console.log('   Your web interface should now load content properly.');
  } else {
    console.log('❌ FAILURE: Both authentication methods failed.');
    console.log('\n🔧 Next steps:');
    console.log('   1. Go to https://www.themoviedb.org/settings/api');
    console.log('   2. Copy your fresh API Key and Read Access Token');
    console.log('   3. Update server/config.js with valid credentials');
    console.log('   4. Run this test again: node test-tmdb-api.js');
  }
  
  console.log('\n📖 For detailed instructions, see: TMDB_SETUP_GUIDE.md');
}

// Check if axios is available
try {
  runTests();
} catch (error) {
  console.log('❌ Error: Missing dependencies');
  console.log('   Run: cd server && npm install');
  console.log('   Then try again: node test-tmdb-api.js');
} 