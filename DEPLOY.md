# Deploying to Vercel (Free)

## One-time setup (~10 minutes)

### 1. Push to GitHub

```bash
cd family-tree
git init
git add .
git commit -m "Family tree app"
```

Then create a new repo on github.com and push:
```bash
git remote add origin https://github.com/YOUR_USERNAME/family-tree.git
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to **vercel.com** and sign in with GitHub
2. Click **"Add New Project"**
3. Select your `family-tree` repository
4. Click **Deploy** (default settings are fine)

Vercel will give you a URL like `https://family-tree-abc123.vercel.app`

### 3. Set up Cloudflare R2 (storage)

1. In the Cloudflare dashboard, go to **R2 Object Storage** and create a bucket named `family-tree`
2. Go to **R2 → Manage API Tokens** and create an API token:
   - Permission: **Object Read & Write**
   - Scope: limit it to the `family-tree` bucket only
3. Copy the **Account ID**, **Access Key ID**, and **Secret Access Key** (the secret is shown only once)

The app saves the tree to `family_tree.json` in the bucket. Every save also writes a timestamped copy under `backups/`, keeping the last 10.

### 4. Set your environment variables

In Vercel project dashboard → **Settings** → **Environment Variables**, add:

| Name | Value | Notes |
|------|-------|-------|
| `FAMILY_PASSWORD` | `your-family-password` | Share this with family |
| `R2_ACCOUNT_ID` | Cloudflare account ID | |
| `R2_ACCESS_KEY_ID` | R2 API token access key | |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret | |
| `R2_BUCKET_NAME` | `family-tree` | |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Optional — for story generation without entering a key each time |

### 5. Redeploy

After adding env vars, go to **Deployments** → click the three dots on the latest deployment → **Redeploy**.

If the Production badge ends up on an old "Redeploy" after several redeploys, use **Promote** on the deployment you want live.

### 6. Share with family

Send family members:
- **URL**: `https://your-project.vercel.app`
- **Password**: whatever you set for `FAMILY_PASSWORD`

Everyone who knows the password can view and edit the family tree.
Data is shared in real-time — changes made by one person are visible to others after they click ↻ Refresh.

---

## Local development (still works)

```bash
npm start
# Password defaults to "family123"
# To change: FAMILY_PASSWORD=mypassword npm start
```

Data is saved to `local-tree.json` (in the project folder) when running locally.

---

## Importing your existing data

If you've been using the app locally and have data in localStorage:

1. Open the app locally (`npm start`)
2. Go to **Save & Share** tab
3. Click **Download JSON** to save your existing data
4. Open the Vercel-hosted version and log in
5. Go to **Save & Share** → **Import** → upload the JSON file

Your data will be saved to the cloud and available to all family members.

**Backups:** download a fresh JSON from **Save & Share** every so often, so you have a copy outside R2.

---

## Custom domain (optional)

In Vercel → Settings → Domains, add a custom domain like `family.yourlastname.com`.
You'll need to own the domain and update its DNS settings.
