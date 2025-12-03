# GitHub Repository Setup Guide

## Step 1: Create Repository on GitHub

1. Go to [github.com/new](https://github.com/new)
2. Fill in the details:
   - **Repository name**: `tsa-tool` (or your preferred name)
   - **Description**: "Interactive Trial Sequential Analysis tool for clinical meta-analysis"
   - **Visibility**: Public (or Private if you prefer)
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
3. Click "Create repository"

## Step 2: Connect Local Repository to GitHub

After creating the repository, GitHub will show you commands. Use these:

```bash
# Add the remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/tsa-tool.git

# Verify the remote was added
git remote -v
```

## Step 3: Commit All Files

```bash
# Stage all files (respecting .gitignore)
git add .

# Create initial commit
git commit -m "Initial commit: Production-ready TSA tool"
```

## Step 4: Push to GitHub

```bash
# Push to main branch
git branch -M main
git push -u origin main
```

## Step 5: Deploy to Vercel (Optional but Recommended)

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Vercel will auto-detect Vite settings
5. Click "Deploy"
6. Your app will be live at `https://your-project.vercel.app`

## Alternative: Deploy to Netlify

1. Go to [netlify.com](https://netlify.com)
2. Drag the `dist` folder to Netlify Drop
3. Or connect your GitHub repo for automatic deployments

## Quick Commands Reference

```bash
# Check status
git status

# Add files
git add .

# Commit changes
git commit -m "Your message"

# Push changes
git push

# Pull latest changes
git pull
```

## Troubleshooting

### If you get "remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/tsa-tool.git
```

### If you need to use SSH instead of HTTPS
```bash
git remote set-url origin git@github.com:YOUR_USERNAME/tsa-tool.git
```

### If push is rejected
```bash
git pull origin main --rebase
git push
```
