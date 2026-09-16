#!/bin/bash
# ============================================================================
# AGI-OS Supabase Setup Script
# ============================================================================

set -e

echo "🚀 AGI-OS Supabase Setup"
echo "========================"

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create it from .env.example"
    exit 1
fi

# Source .env file
source .env

echo ""
echo "📋 Setup Steps:"
echo "1. Create a new Supabase project at https://app.supabase.com"
echo "2. Get your project URL and API keys from Settings > API"
echo "3. Update .env with your credentials"
echo ""

read -p "Enter your Supabase URL: " SUPABASE_URL
read -p "Enter your Supabase Anon Key: " SUPABASE_ANON_KEY
read -p "Enter your Supabase Service Key: " SUPABASE_SERVICE_KEY

# Update .env file
sed -i "s|SUPABASE_URL=.*|SUPABASE_URL=$SUPABASE_URL|g" .env
sed -i "s|SUPABASE_ANON_KEY=.*|SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY|g" .env
sed -i "s|SUPABASE_SERVICE_KEY=.*|SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY|g" .env

echo ""
echo "✅ Environment variables updated!"
echo ""
echo "📊 Running database migrations..."

# Run migrations using Supabase CLI
if command -v supabase &> /dev/null; then
    supabase db push
    echo "✅ Database migrations completed!"
else
    echo "⚠️  Supabase CLI not available. Please run migrations manually:"
    echo "   Go to Supabase Dashboard > SQL Editor"
    echo "   Paste contents of: supabase/migrations/001_initial_schema.sql"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Deploy backend to HuggingFace Spaces"
echo "2. Deploy frontend to Cloudflare Pages"
