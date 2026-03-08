# Build from GitHub (skip local compression)

When "Compressing project files" hangs on your Mac, build from GitHub instead. Expo will clone your repo and build on their servers — no upload from your machine.

## 1. One-time: Put your code on GitHub

### Step A: Create the new repo on GitHub (in your browser)

1. Go to **https://github.com** and sign in.
2. In the top-left, click the **+** (plus) next to your profile picture.
3. Click **“New repository”**.
4. Fill in:
   - **Repository name:** `square18` (or any name you like).
   - **Description:** optional (e.g. “Golf score app”).
   - **Public** is fine.
   - **Do not** check “Add a README file”.
   - **Do not** add a .gitignore or license.
5. Click the green **“Create repository”** button.
6. You’ll see a page that says “Quick setup” and shows a URL like  
   `https://github.com/YOUR_USERNAME/square18.git`.  
   Leave this tab open; you’ll use that URL in Step B.

### Step B: Push your code from Terminal

Open your **external Terminal** and run:

```bash
cd /Users/thecrawfords/Desktop/square18
```

If you don’t have a commit yet:

```bash
git add --all -- ':!.env' ':!.env.*' ':!.env.local' ':!.expo'
git commit -m "Course selection, remove Aspetuck, config fixes"
```
(Excluding `.expo` avoids "short read" errors on `.expo/devices.json`.)

Then connect to GitHub and push (use the **exact** URL from the “Quick setup” page — replace `YOUR_USERNAME` with your real GitHub username (e.g. tjcrawford01). Create the commit above first or you'll get "fatal: failed to resolve HEAD"):

```bash
git remote add origin https://github.com/YOUR_USERNAME/square18.git
git branch -M main
git push -u origin main
```

If it asks for credentials: use your GitHub username and a **Personal Access Token** as the password (GitHub no longer accepts your normal account password for git over HTTPS). To create one: GitHub → **Settings** (your profile) → **Developer settings** → **Personal access tokens** → **Generate new token**; give it **repo** scope.

## 2. Connect GitHub to Expo (one-time)

1. Go to **https://expo.dev/accounts/tjcrawford01/projects/square18**
2. In the left sidebar, open **Project** → **GitHub** (or **Settings** / **Build** and find “GitHub” or “Build from GitHub”).
3. Connect your GitHub account and select the **square18** repository.
4. Save.

## 3. Start a build from the Expo dashboard

1. Go to **https://expo.dev/accounts/tjcrawford01/projects/square18/builds**
2. Click **“Build from GitHub”** (or the equivalent button).
3. Choose **iOS**, branch **main**, and start the build.
4. When it finishes, use that build’s **Install** link or QR code on your iPhone.

No local compression or upload — the build runs entirely on Expo’s side.
