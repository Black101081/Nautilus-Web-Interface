# Cloudflare Pages Setup Guide

Deploy the React frontend to Cloudflare Pages in ~5 minutes.

> The FastAPI backend must be hosted separately (VPS, Railway, Render, etc.).
> See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for backend deployment options.

---

## Step 1 — Connect GitHub Repository

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. **Workers & Pages** → **Create Application** → **Pages** → **Connect to Git**
3. Select GitHub and authorize Cloudflare
4. Choose repository: `Black101081/Nautilus-Web-Interface`

---

## Step 2 — Build Settings

| Setting | Value |
|---------|-------|
| Framework preset | None (Custom) |
| Build command | `cd frontend && npm ci && npm run build` |
| Build output directory | `frontend/dist` |
| Root directory | _(leave empty)_ |
| Node.js version | `18` |

---

## Step 3 — Environment Variables

Add these in the Cloudflare Pages **Environment variables** section:

| Name | Value |
|------|-------|
| `VITE_NAUTILUS_API_URL` | `https://your-backend-api.com` |
| `VITE_WS_URL` | `wss://your-backend-api.com` |
| `VITE_API_KEY` | _(your API key, if `API_KEY` is set on the backend)_ |
| `NODE_VERSION` | `18` |

> `VITE_ADMIN_DB_API_URL` defaults to `http://localhost:8001` if not set.
> Set it if you deploy the admin DB API separately.

**Important**: environment variables for Vite must start with `VITE_`. Rebuild the deployment after adding or changing variables.

---

## Step 4 — Deploy

Click **Save and Deploy**. Build takes ~2 minutes.

Your site will be live at `https://nautilus-web-interface.pages.dev`.

---

## Custom Domain (Optional)

1. Go to the **Custom domains** tab in your Pages project
2. Click **Set up a custom domain** (e.g. `app.yourdomain.com`)
3. Follow the DNS instructions
4. Cloudflare auto-provisions an SSL certificate

---

## Continuous Deployment

Cloudflare Pages deploys automatically on every push:

- **`main` branch** → Production deployment (`*.pages.dev`)
- **Other branches / PRs** → Preview deployments (`[commit-hash].*.pages.dev`)

---

## GitHub Actions (Optional)

For more control, add `.github/workflows/deploy.yml`:

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
        env:
          VITE_NAUTILUS_API_URL: ${{ secrets.VITE_NAUTILUS_API_URL }}
          VITE_WS_URL: ${{ secrets.VITE_WS_URL }}
          VITE_API_KEY: ${{ secrets.VITE_API_KEY }}
      - name: Deploy
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: nautilus-web-interface
          directory: frontend/dist
```

Store secrets in **GitHub → Settings → Secrets and variables → Actions**.

---

## Troubleshooting

### Build fails — missing dependencies
Check that `package.json` is up to date and `node_modules` is in `.gitignore`.

### Build fails — wrong Node version
Add environment variable `NODE_VERSION=18` in the Cloudflare Pages dashboard.

### API calls fail (network error / CORS)
1. Verify `VITE_NAUTILUS_API_URL` points to your live backend
2. Verify backend `CORS_ORIGINS` includes your `*.pages.dev` URL
3. Rebuild the Cloudflare Pages deployment after changing environment variables

### WebSocket not connecting
Use `wss://` (not `ws://`) in `VITE_WS_URL` when the backend has HTTPS/TLS.

---

## Cloudflare Pages — Free Tier Limits

| Feature | Limit |
|---------|-------|
| Requests | Unlimited |
| Bandwidth | Unlimited |
| Builds per month | 500 |
| Concurrent builds | 1 |

Includes free SSL, global CDN (300+ locations), HTTP/3, and Brotli compression.

---

**Last Updated**: March 2026
