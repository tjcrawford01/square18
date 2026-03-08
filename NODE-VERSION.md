# Use Node 20 for this project

Expo/Metro crash on Node 24 with "default is not a constructor/function" errors. Use **Node 20 LTS** for this repo.

## Option A: nvm (recommended – keeps Node 24 for other projects)

1. Install nvm (if you don't have it):
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
   ```
   Then **close and reopen Terminal** (or run `source ~/.zshrc`).

2. Install and use Node 20:
   ```bash
   nvm install 20
   nvm use 20
   ```

3. In the project:
   ```bash
   cd /Users/thecrawfords/Desktop/square18
   rm -rf node_modules
   npm install
   node node_modules/expo/bin/cli start --clear --ios
   ```

To switch back to Node 24 later: `nvm use 24`.

## Option B: Install Node 20 from nodejs.org

1. Go to https://nodejs.org and download the **20.x LTS** installer.
2. Run the installer (this will replace your current Node with 20).
3. Restart Terminal, then:
   ```bash
   cd /Users/thecrawfords/Desktop/square18
   rm -rf node_modules
   npm install
   node node_modules/expo/bin/cli start --clear --ios
   ```

After Step 3 (either option), the iOS Simulator should start without the Metro TypeError.
