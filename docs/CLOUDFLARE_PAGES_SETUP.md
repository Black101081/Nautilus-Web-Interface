# Cloudflare Pages Setup Guide

## Quick Setup (5 Minutes)

### Step 1: Connect GitHub Repository

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** → **Create Application** → **Pages**
3. Click **Connect to Git**
4. Select **GitHub** and authorize Cloudflare
5. Select repository: `Black101081/Nautilus-Web-Interface`

### Step 2: Configure Build Settings

**Framework preset**: None (Custom)

**Build configuration**:
- **Build command**: `cd frontend && npm install && npm run build`
- **Build output directory**: `frontend/dist`
- **Root directory**: `/` (leave empty)

**Environment variables**:
- Name: `VITE_API_URL`
- Value: `https://your-api-domain.com` (your backend URL)

### Step 3: Deploy

1. Click **Save and Deploy**
2. Wait for build to complete (~2-3 minutes)
3. Your site will be live at: `https://nautilus-web-interface.pages.dev`

### Step 4: Custom Domain (Optional)

1. Go to **Custom domains** tab
2. Click **Set up a custom domain**
3. Enter your domain (e.g., `admin.yourdomain.com`)
4. Follow DNS configuration instructions

## Advanced Configuration

### Build Settings

For optimal performance, use these settings:

```yaml
Build command: cd frontend && npm ci && npm run build
Build output directory: frontend/dist
Root directory: (leave empty)
Node version: 18
```

### Environment Variables

Add these in Cloudflare Pages dashboard:

```
VITE_API_URL=https://your-backend-api.com
NODE_VERSION=18
```

### Preview Deployments

Cloudflare automatically creates preview deployments for:
- Pull requests
- Non-production branches

Access previews at: `https://[commit-hash].nautilus-web-interface.pages.dev`

## Continuous Deployment

Cloudflare Pages automatically deploys when you push to GitHub:

1. **Push to main branch** → Production deployment
2. **Push to other branches** → Preview deployment
3. **Create pull request** → Preview deployment with comment

## Backend Deployment

Your FastAPI backend needs separate hosting. Options:

### Option 1: Cloudflare Workers (Recommended)

Convert FastAPI to Workers:
```bash
# Install wrangler
npm install -g wrangler

# Create worker
wrangler init nautilus-api

# Deploy
wrangler publish
```

### Option 2: Traditional Hosting

Deploy backend to:
- **DigitalOcean** - $5/month droplet
- **AWS EC2** - t2.micro free tier
- **Heroku** - Free tier available
- **Railway** - Free tier with GitHub integration

### Option 3: Docker Container

Deploy to:
- **Google Cloud Run** - Pay per use
- **AWS ECS** - Container service
- **Azure Container Instances**

## DNS Configuration

If using custom domain:

1. **For Cloudflare DNS**:
   - CNAME record automatically added
   - SSL certificate auto-provisioned

2. **For External DNS**:
   - Add CNAME: `admin.yourdomain.com` → `nautilus-web-interface.pages.dev`
   - Wait for DNS propagation (up to 48 hours)

## SSL/HTTPS

Cloudflare Pages provides:
- ✅ Free SSL certificate
- ✅ Auto-renewal
- ✅ HTTP/2 and HTTP/3 support
- ✅ Always HTTPS redirect

## Performance Optimization

Cloudflare Pages includes:
- Global CDN (200+ locations)
- Automatic asset optimization
- Brotli compression
- Smart caching

## Monitoring

View deployment logs and analytics:
1. Go to **Workers & Pages** → **nautilus-web-interface**
2. Click **View details** on any deployment
3. Check **Functions logs** and **Analytics**

## Troubleshooting

### Build Fails

Check build logs in Cloudflare dashboard:
```bash
# Common issues:
- Missing dependencies → Check package.json
- Wrong Node version → Set NODE_VERSION=18
- Build command error → Verify build command
```

### Environment Variables Not Working

1. Verify variable name starts with `VITE_`
2. Rebuild after adding variables
3. Check variable is used in code

### API Connection Fails

1. Check CORS settings in backend
2. Verify API URL in environment variables
3. Test API endpoint directly

## GitHub Actions (Optional)

To add automated workflows, create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Build
        working-directory: ./frontend
        run: |
          npm ci
          npm run build
      - name: Deploy
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: nautilus-web-interface
          directory: frontend/dist
```

**Note**: You'll need to add this file manually via GitHub web interface or with proper permissions.

## Cost

Cloudflare Pages is **FREE** for:
- Unlimited requests
- Unlimited bandwidth
- 500 builds per month
- 1 concurrent build

## Next Steps

After deployment:

1. ✅ Test your live site
2. ✅ Configure custom domain
3. ✅ Deploy backend API
4. ✅ Update API_URL in Cloudflare Pages
5. ✅ Test end-to-end integration

## Support

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare Community](https://community.cloudflare.com/)
- [GitHub Issues](https://github.com/Black101081/Nautilus-Web-Interface/issues)

---

**Your site will be live at**: `https://nautilus-web-interface.pages.dev`

**Estimated setup time**: 5-10 minutes

**Status**: Ready to deploy! 🚀

