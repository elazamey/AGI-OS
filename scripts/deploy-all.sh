#!/bin/bash
# ============================================================================
# AGI-OS Master Deployment Script
# ============================================================================

set -e

echo "🚀 AGI-OS Free Cloud Deployment"
echo "================================"
echo ""
echo "This script will deploy AGI-OS to free cloud services:"
echo "  1. Supabase (Database)"
echo "  2. HuggingFace Spaces (Backend)"
echo "  3. Cloudflare Pages (Frontend)"
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# ============================================================================
# STEP 1: Supabase Setup
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 STEP 1: Supabase Database Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -f .env.supabase ]; then
    echo "Please create .env.supabase with your Supabase credentials:"
    echo ""
    echo "SUPABASE_URL=https://your-project.supabase.co"
    echo "SUPABASE_ANON_KEY=your-anon-key"
    echo "SUPABASE_SERVICE_KEY=your-service-key"
    echo ""
    read -p "Press Enter when ready..."
fi

print_step "Supabase configuration ready"

# ============================================================================
# STEP 2: HuggingFace Spaces
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤗 STEP 2: HuggingFace Spaces Backend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Do you want to deploy to HuggingFace Spaces? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    bash scripts/deploy-huggingface.sh
    print_step "HuggingFace deployment initiated"
else
    print_warning "Skipping HuggingFace deployment"
fi

# ============================================================================
# STEP 3: Cloudflare Pages
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "☁️  STEP 3: Cloudflare Pages Frontend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Do you want to deploy to Cloudflare Pages? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    bash scripts/deploy-cloudflare-pages.sh
    print_step "Cloudflare deployment initiated"
else
    print_warning "Skipping Cloudflare deployment"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 DEPLOYMENT SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Your AGI-OS system will be available at:"
echo ""
echo "  📊 Database:  Supabase Dashboard"
echo "  🤖 Backend:   https://huggingface.co/spaces/elazamey/agi-os-backend"
echo "  🌐 Frontend:  https://agi-os-web.pages.dev"
echo ""
echo "Cost: $0 (100% Free)"
echo ""
echo "Next steps:"
echo "1. Update environment variables with actual URLs"
echo "2. Test all endpoints"
echo "3. Configure custom domain (optional)"
echo ""
