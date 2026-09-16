#!/bin/bash
# ============================================================================
# AGI-OS Cloudflare Pages Deployment Script
# ============================================================================

set -e

echo "☁️  AGI-OS Cloudflare Pages Deployment"
echo "======================================="

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Check if logged in
echo ""
echo "📋 Checking Cloudflare login..."
wrangler whoami || wrangler login

# Configuration
PROJECT_NAME="agi-os-web"

# Build dashboard
echo ""
echo "🔨 Building dashboard..."
cd packages/dashboard
pnpm install
pnpm build

# Deploy to Cloudflare Pages
echo ""
echo "🚀 Deploying to Cloudflare Pages..."
npx wrangler pages deploy dist --project-name $PROJECT_NAME

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your dashboard will be available at:"
echo "   https://$PROJECT_NAME.pages.dev"
echo ""
echo "📋 Next steps:"
echo "1. Go to Cloudflare Dashboard > Pages"
echo "2. Click on your project"
echo "3. Go to Settings > Environment variables"
echo "4. Add your Supabase and API credentials"
