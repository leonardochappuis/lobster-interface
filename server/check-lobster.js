#!/usr/bin/env node

// Quick script to check if lobster script exists and is executable
const fs = require('fs');
const path = require('path');
const config = require('./config.js');

console.log('🔍 Checking lobster script configuration...\n');

const lobsterPath = path.resolve(__dirname, config.LOBSTER_SCRIPT_PATH);
console.log(`📂 Looking for lobster script at: ${lobsterPath}`);

// Check if file exists
if (fs.existsSync(lobsterPath)) {
  console.log('✅ Lobster script file found!');
  
  // Check if it's executable
  try {
    fs.accessSync(lobsterPath, fs.constants.F_OK | fs.constants.R_OK);
    console.log('✅ Lobster script is readable');
    
    // Read first few lines to verify it's a shell script
    const content = fs.readFileSync(lobsterPath, 'utf8');
    const firstLine = content.split('\n')[0];
    
    if (firstLine.includes('#!/bin/bash') || firstLine.includes('#!/usr/bin/bash')) {
      console.log('✅ Lobster script appears to be a valid bash script');
    } else {
      console.log('⚠️  Warning: Script may not be a bash script (first line: ' + firstLine + ')');
    }
    
    console.log('\n🎬 Ready to launch lobster!');
    console.log('   When you click "Watch" in the web interface:');
    console.log('   • A new terminal window should open');
    console.log('   • The lobster TUI should be visible');
    console.log('   • You can interact with the movie selection menu');
    
  } catch (error) {
    console.log('❌ Error accessing lobster script:', error.message);
    console.log('   Try: chmod +x ' + lobsterPath);
  }
  
} else {
  console.log('❌ Lobster script not found!');
  console.log('\n🔧 Possible fixes:');
  console.log('   1. Check if lobster.sh exists in the parent directory');
  console.log('   2. Update LOBSTER_SCRIPT_PATH in server/config.js');
  console.log('   3. Current path: ' + lobsterPath);
  console.log('   4. Make sure the path is relative to server/ directory');
}

console.log('\n📋 Current config:');
console.log('   LOBSTER_SCRIPT_PATH:', config.LOBSTER_SCRIPT_PATH);
console.log('   Resolved path:', lobsterPath); 