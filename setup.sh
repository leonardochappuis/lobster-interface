#!/bin/bash

# Lobster Web Interface Setup Script
echo "🦞 Setting up Lobster Web Interface..."
echo "=================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js (v16 or higher) first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm $(npm -v) detected"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
echo "This may take a few minutes..."

# Install root dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..

# Install client dependencies
cd client
npm install
cd ..

echo ""
echo "✅ All dependencies installed successfully!"

# Check if lobster.sh exists
if [ ! -f "lobster.sh" ]; then
    echo ""
    echo "⚠️  Warning: lobster.sh not found in current directory"
    echo "   Make sure your lobster script is in the correct location"
    echo "   or update LOBSTER_SCRIPT_PATH in server/config.js"
fi

# Create database directory
mkdir -p server/data

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📚 Quick Start:"
echo "   • Development: npm run dev"
echo "   • Production:  npm run build && npm start"
echo ""
echo "🌐 URLs:"
echo "   • Frontend: http://localhost:3000 (development)"
echo "   • Backend:  http://localhost:5000"
echo ""
echo "📖 For detailed instructions, see WEB_INTERFACE_README.md"
echo ""
echo "🚀 To start development server:"
echo "   npm run dev"
echo "" 