#!/bin/bash
# ============================================================================
# AGI-OS HuggingFace Spaces Deployment Script
# ============================================================================

set -e

echo "🤗 AGI-OS HuggingFace Spaces Deployment"
echo "========================================"

# Configuration
HF_USERNAME="elazamey"
SPACE_NAME="agi-os-backend"

# Check if git is configured
if ! git config --get user.name &> /dev/null; then
    echo "❌ Git user not configured. Please run:"
    echo "   git config --global user.name 'Your Name'"
    echo "   git config --global user.email 'your@email.com'"
    exit 1
fi

# Check if huggingface-cli is installed
if ! command -v huggingface-cli &> /dev/null; then
    echo "⚠️  HuggingFace CLI not found. Installing..."
    pip install -U huggingface_hub
fi

# Login to HuggingFace
echo ""
echo "📋 Please login to HuggingFace:"
huggingface-cli login

# Clone the Space
echo ""
echo "📥 Cloning Space repository..."
git clone https://huggingface.co/spaces/$HF_USERNAME/$SPACE_NAME || true

# Copy files
echo ""
echo "📁 Copying backend files..."
cp -r apps/hf-backend/* $SPACE_NAME/

# Copy the special Dockerfile
cp apps/hf-backend/Dockerfile.hf $SPACE_NAME/Dockerfile

# Copy requirements
cp apps/hf-backend/requirements.txt $SPACE_NAME/

# Push to HuggingFace
echo ""
echo "🚀 Pushing to HuggingFace Spaces..."
cd $SPACE_NAME
git add .
git commit -m "Deploy AGI-OS backend" || echo "No changes to commit"
git push

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your Space will be available at:"
echo "   https://huggingface.co/spaces/$HF_USERNAME/$SPACE_NAME"
echo ""
echo "⏳ Note: It may take a few minutes for the Space to build and start."
