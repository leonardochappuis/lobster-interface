#!/usr/bin/env node

// Simple test script to verify video source fixes
const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testVideoSources() {
  console.log('🧪 Testing Lobster Video Source Fixes...\n');

  try {
    // Test 1: Search for a movie
    console.log('1️⃣ Testing search functionality...');
    const searchResponse = await axios.get(`${BASE_URL}/api/lobster/search/inception`);
    
    if (searchResponse.data.results && searchResponse.data.results.length > 0) {
      console.log('✅ Search working - found', searchResponse.data.results.length, 'results');
      
      const testMovie = searchResponse.data.results.find(r => r.media_type === 'movie');
      if (!testMovie) {
        console.log('❌ No movies found in search results');
        return;
      }
      
      console.log('🎬 Testing with:', testMovie.title);
      
      // Test 2: Get video sources with quality enabled
      console.log('\n2️⃣ Testing video sources with quality enabled...');
      const sourcesResponse1 = await axios.post(`${BASE_URL}/api/lobster/sources`, {
        media_id: testMovie.id,
        media_type: 'movie',
        provider: 'Vidcloud',
        language: 'english',
        quality: '1080',
        enable_quality: 'true'
      });
      
      if (sourcesResponse1.data.video_links && sourcesResponse1.data.video_links.length > 0) {
        console.log('✅ Video sources obtained with quality modification');
        const source = sourcesResponse1.data.video_links[0];
        console.log('📹 Primary URL:', source.file ? source.file.substring(0, 80) + '...' : 'None');
        console.log('🔄 Fallback URL:', source.originalFile ? source.originalFile.substring(0, 80) + '...' : 'None');
        
        // Test 3: Test video source accessibility
        if (source.file) {
          console.log('\n3️⃣ Testing video source accessibility...');
          try {
            const testResponse = await axios.post(`${BASE_URL}/api/lobster/test-source`, {
              url: source.file
            });
            
            if (testResponse.data.accessible) {
              console.log('✅ Video source is accessible');
            } else {
              console.log('⚠️ Video source not accessible:', testResponse.data.error);
              
              if (source.originalFile && source.originalFile !== source.file) {
                console.log('🔄 Testing fallback URL...');
                const fallbackTest = await axios.post(`${BASE_URL}/api/lobster/test-source`, {
                  url: source.originalFile
                });
                
                if (fallbackTest.data.accessible) {
                  console.log('✅ Fallback URL is accessible');
                } else {
                  console.log('❌ Fallback URL also not accessible:', fallbackTest.data.error);
                }
              }
            }
          } catch (testError) {
            console.log('❌ Test source endpoint error:', testError.message);
          }
        }
      } else {
        console.log('❌ No video sources obtained');
        console.log('Response:', sourcesResponse1.data);
      }
      
      // Test 4: Get video sources with quality disabled
      console.log('\n4️⃣ Testing video sources with quality disabled...');
      try {
        const sourcesResponse2 = await axios.post(`${BASE_URL}/api/lobster/sources`, {
          media_id: testMovie.id,
          media_type: 'movie',
          provider: 'Vidcloud',
          language: 'english',
          quality: '1080',
          enable_quality: 'false'
        });
        
        if (sourcesResponse2.data.video_links && sourcesResponse2.data.video_links.length > 0) {
          console.log('✅ Video sources obtained with quality disabled');
          const source2 = sourcesResponse2.data.video_links[0];
          console.log('📹 URL (should be unmodified):', source2.file ? source2.file.substring(0, 80) + '...' : 'None');
        } else {
          console.log('❌ No video sources obtained with quality disabled');
        }
      } catch (error) {
        console.log('❌ Error testing quality disabled:', error.message);
      }
      
    } else {
      console.log('❌ Search failed or no results found');
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    if (error.response && error.response.data) {
      console.log('Error details:', error.response.data);
    }
  }
  
  console.log('\n🏁 Test completed!');
  console.log('\n💡 Tips for debugging:');
  console.log('- Check server logs for detailed error messages');
  console.log('- Try different providers (Vidcloud/UpCloud) if one fails');
  console.log('- Disable quality modification in settings if sources fail');
  console.log('- Check network connectivity and DNS resolution');
}

// Run the test
testVideoSources().catch(console.error); 