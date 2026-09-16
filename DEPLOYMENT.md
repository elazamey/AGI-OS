# AGI-OS Deployment Guide (Free Tier Strategy)

**Version:** 1.0.0
**Last Updated:** 2026-09-15
**Cost:** $0 (100% Free)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        AGI-OS System                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   web-ui     │  │  workspace   │  │  hf-backend  │          │
│  │  (Next.js)   │  │  (React)     │  │  (FastAPI)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Cloudflare  │  │    Vercel    │  │   Hugging    │          │
│  │    Pages     │  │              │  │   Face       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Supabase                              │  │
│  │  (PostgreSQL + Auth + Storage + Edge Functions)          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Cloudflare Workers                       │  │
│  │  (API Gateway + Edge Functions - 100K requests/day)      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Create Free Accounts

| Service | URL | Purpose |
|---------|-----|---------|
| Cloudflare | https://dash.cloudflare.com | Pages, Workers, DNS |
| Vercel | https://vercel.com | Frontend hosting |
| Hugging Face | https://huggingface.co | Backend/ML hosting |
| Supabase | https://supabase.com | Database + Auth |

---

## Step 2: Deploy Frontend to Cloudflare Pages

### 2.1 Install Cloudflare CLI

```bash
# Windows (using winget)
winget install Cloudflare.cloudflared

# Or download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
```

### 2.2 Build & Deploy web-ui

```bash
# From project root
cd packages/dashboard

# Install dependencies
pnpm install

# Build for production
pnpm build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name agi-os-web
```

### 2.3 Deploy workspace

```bash
cd apps/workspace

# Install and build
pnpm install
pnpm build

# Deploy
npx wrangler pages deploy dist --project-name agi-os-workspace
```

---

## Step 3: Deploy Backend to Hugging Face Spaces

### 3.1 Create a new Space

1. Go to https://huggingface.co/new-space
2. Name: `agi-os-backend`
3. License: Apache 2.0
4. SDK: **Docker** or **Gradio** (for API)
5. Visibility: Public

### 3.2 Push the hf-backend

```bash
# Clone the Space
git clone https://huggingface.co/spaces/elazamey/agi-os-backend

# Copy the backend files
cp -r apps/hf-backend/* agi-os-backend/

# Push to Hugging Face
cd agi-os-backend
git add .
git commit -m "Deploy AGI-OS backend"
git push
```

---

## Step 4: Setup Supabase Database

### 4.1 Create Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Name: `agi-os`
4. Database Password: (save securely)
5. Region: Choose closest to your users

### 4.2 Run Migrations

```sql
-- Create missions table
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create agents table
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  state TEXT DEFAULT 'idle',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create memory table
CREATE TABLE memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4.3 Get API Keys

```bash
# Add to your .env file
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

---

## Step 5: Setup Cloudflare Workers (API Gateway)

### 5.1 Create Worker

```bash
# Create a new worker
npx wrangler init agi-os-api

# Or deploy existing API
npx wrangler deploy packages/api-server/src/index.ts
```

### 5.2 Configure Environment Variables

```bash
# Set secrets
npx wrangler secret put NVIDIA_API_KEY
npx wrangler secret put SUPABASE_SERVICE_KEY
```

---

## Step 6: Connect Everything

### 6.1 Update Frontend Environment

```bash
# In packages/dashboard/.env.local
NEXT_PUBLIC_API_URL=https://agi-os-api.your-subdomain.workers.dev
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 6.2 Configure CORS

```javascript
// In your API Worker
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

---

## Step 7: Setup Custom Domain (Free)

### 7.1 Use Cloudflare DNS

1. Go to Cloudflare Dashboard > DNS
2. Add CNAME records:
   ```
   agi-os.pages.dev → elazamey.github.io
   api.agi-os.pages.dev → agi-os-api.workers.dev
   ```

### 7.2 Enable SSL

Cloudflare provides free SSL certificates for all domains.

---

## Monitoring & Logs

### Cloudflare Analytics
- Free analytics for Pages and Workers
- Real-time logs available in dashboard

### Supabase Dashboard
- Database metrics
- API logs
- Auth logs

---

## Cost Breakdown

| Service | Free Tier | Your Usage |
|---------|-----------|------------|
| Cloudflare Pages | Unlimited | ~100 builds/month |
| Cloudflare Workers | 100K requests/day | ~10K requests/day |
| Hugging Face Spaces | Free CPU | Running 24/7 |
| Supabase | 500MB database | ~100MB |
| **Total** | **$0** | **$0** |

---

## Troubleshooting

### Common Issues

1. **Build fails on Cloudflare Pages**
   - Check build output directory (usually `dist` or `build`)
   - Ensure all dependencies are in `package.json`

2. **CORS errors**
   - Add your frontend domain to allowed origins
   - Check Worker CORS headers

3. **Database connection fails**
   - Verify Supabase URL and keys
   - Check if IP is whitelisted

---

## Security Notes

- Never commit API keys to git
- Use environment variables for all secrets
- Enable Row Level Security (RLS) in Supabase
- Use HTTPS everywhere (Cloudflare provides this free)

---

## Next Steps

1. Set up CI/CD with GitHub Actions
2. Configure monitoring alerts
3. Add custom domain
4. Enable rate limiting on Workers
