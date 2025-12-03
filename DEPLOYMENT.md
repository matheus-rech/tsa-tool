# Deployment Guide

## 🚀 Vercel Deployment

### Method 1: Web Interface (Recommended - 2 minutes)

1. **Go to [vercel.com](https://vercel.com)**
2. Click **"Sign Up"** → **"Continue with GitHub"**
3. Authorize Vercel to access your repositories
4. Click **"Add New"** → **"Project"**
5. Find and select **`matheus-rech/tsa-tool`**
6. Click **"Deploy"** (Vercel auto-detects all settings)
7. Wait ~30 seconds
8. ✅ Done! Your app is live at `https://tsa-tool-[random].vercel.app`

**Optional: Customize URL**
- Go to Project Settings → Domains
- Change to `tsa-tool.vercel.app` or add your custom domain

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd /Users/matheusrech/.gemini/antigravity/playground/shining-halo
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name? tsa-tool
# - Directory? ./
# - Override settings? No

# Production deployment
vercel --prod
```

---

## 🌐 Netlify Deployment

### Method 1: Drag & Drop (Easiest - 1 minute)

1. **Build the project locally:**
   ```bash
   cd /Users/matheusrech/.gemini/antigravity/playground/shining-halo
   npm run build
   ```

2. **Go to [netlify.com/drop](https://app.netlify.com/drop)**
3. **Drag the `dist` folder** onto the page
4. ✅ Done! Your app is live at `https://[random-name].netlify.app`

**Optional: Customize URL**
- Click "Site settings" → "Change site name"
- Change to `tsa-tool.netlify.app`

### Method 2: Git Integration (Auto-deploy on push)

1. **Go to [app.netlify.com](https://app.netlify.com)**
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **"Deploy with GitHub"**
4. Authorize Netlify
5. Select **`matheus-rech/tsa-tool`**
6. Netlify auto-detects settings (from `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
7. Click **"Deploy site"**
8. ✅ Done! Auto-deploys on every push to `main`

### Method 3: Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
cd /Users/matheusrech/.gemini/antigravity/playground/shining-halo
netlify deploy

# Production deployment
netlify deploy --prod
```

---

## 📊 After Deployment

### Update README with Live URLs

Once deployed, update your README:

```bash
# Edit README.md and add your URLs:
# - Vercel: https://tsa-tool.vercel.app
# - Netlify: https://tsa-tool.netlify.app

git add README.md vercel.json netlify.toml
git commit -m "Add deployment configurations and live URLs"
git push
```

Both platforms will auto-redeploy when you push!

---

## 🔧 Troubleshooting

### Vercel Issues
- **Build fails**: Check build logs in Vercel dashboard
- **404 on routes**: Vercel handles this automatically for SPAs

### Netlify Issues
- **Build fails**: Check `netlify.toml` configuration
- **404 on routes**: The redirect rule in `netlify.toml` handles this

### Both Platforms
- **Node version**: Both use Node 18+ by default (perfect for this project)
- **Environment variables**: Not needed for this project
- **Build time**: ~30-60 seconds on both platforms

---

## 🎯 Recommended Workflow

1. **Use Vercel for primary deployment** (better performance)
2. **Use Netlify as backup/alternative** (good for testing)
3. Both will auto-deploy on every `git push`
4. Compare performance and choose your favorite!

---

## 📈 Monitoring

### Vercel
- Analytics: Project → Analytics tab
- Logs: Project → Deployments → Click deployment → Logs

### Netlify
- Analytics: Site → Analytics (requires paid plan)
- Logs: Site → Deploys → Click deployment → Deploy log
