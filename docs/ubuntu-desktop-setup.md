# NeuSpeak on Ubuntu Desktop — Beginner Tutorial

This guide shows you how to **download the NeuSpeak source code** onto your own computer running **Ubuntu 26.04 LTS** (your desktop, not a Guest OS or virtual machine), then open the app at `http://localhost:5173`.

You will use:

- **Terminal** — the text window where you type commands
- **Git** — downloads (clones) the project from GitHub
- **Node.js / npm** — runs the NeuSpeak web app

Estimated time: about 15–30 minutes the first time.

---

## What you will have at the end

1. The NeuSpeak folder on your desktop (or in your home folder)
2. The app running in your browser at **http://localhost:5173**

---

## Step 0 — Open a Terminal

1. Press the **Super** key (Windows key) to open Activities.
2. Type `Terminal` and press **Enter**.

A black or dark window opens. That is where you will type the commands below.  
After each command, press **Enter**.

Tip: you can copy a command from this page and paste it into Terminal with **Ctrl+Shift+V**.

---

## Step 1 — Install Git and curl

Git downloads the source code. `curl` helps install Node.js.

Copy and paste this whole block, then press Enter:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates
```

- If Ubuntu asks for your password, type it and press Enter.  
  (Nothing appears while you type — that is normal.)
- Wait until the commands finish and you see your prompt again (something like `you@computer:~$`).

Check that Git works:

```bash
git --version
```

You should see a line like `git version 2.x.x`.

---

## Step 2 — Install Node.js (version 22)

NeuSpeak needs **Node.js**. The easiest way on Ubuntu is to use **nvm** (Node Version Manager).

### 2a. Install nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Close the Terminal window completely, then open a **new** Terminal.  
(This loads nvm.)

Check nvm:

```bash
command -v nvm
```

You should see `nvm`. If you see nothing, log out of Ubuntu and log back in, then try again.

### 2b. Install Node.js 22

```bash
nvm install 22
nvm use 22
```

Check versions:

```bash
node -v
npm -v
```

You want something like:

- `node -v` → `v22.x.x`
- `npm -v` → `10.x.x` (or similar)

---

## Step 3 — Choose where to put the project

Most beginners use the Desktop or the home folder.

### Option A — Desktop (easy to find in the file manager)

```bash
cd ~/Desktop
```

If you get an error that `Desktop` does not exist, use Option B.

### Option B — Home folder

```bash
cd ~
mkdir -p Projects
cd Projects
```

---

## Step 4 — Download (clone) the NeuSpeak source code

This copies the project from GitHub onto your computer.

### If the repository is **public**

```bash
git clone https://github.com/Nueavenue/neuspeak.git
cd neuspeak
```

### If the repository is **private**

1. On GitHub, sign in as a user who can access **Nueavenue/neuspeak**.
2. Create a **Personal Access Token** (classic) with the `repo` scope:  
   GitHub → Settings → Developer settings → Personal access tokens.
3. Clone using your GitHub username. When Git asks for a password, paste the **token** (not your GitHub password):

```bash
git clone https://github.com/Nueavenue/neuspeak.git
cd neuspeak
```

You should now be inside the project folder. Confirm:

```bash
pwd
ls
```

You should see files such as `package.json`, `README.md`, and folders like `src` and `docs`.

---

## Step 5 — Create your local settings file (`.env`)

The app reads secrets from a file named `.env`.  
That file is **not** in Git (for safety). You create it from the example.

```bash
cp .env.example .env
```

Open it in a simple editor:

```bash
nano .env
```

You will see lines like:

```env
OPENAI_API_KEY=
ORIGIN_URL=http://localhost:5173
...
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
PUBLIC_SITE_URL=http://localhost:5173
```

### What to fill in

| Variable | What it is | Required to open the site? |
| --- | --- | --- |
| `OPENAI_API_KEY` | Your OpenAI API key (`sk-...`) | Needed for live voice coaching |
| `PUBLIC_SUPABASE_URL` | Your Supabase project URL | Needed for login / signup |
| `PUBLIC_SUPABASE_ANON_KEY` | Your Supabase “anon” key | Needed for login / signup |
| `ORIGIN_URL` / `PUBLIC_SITE_URL` | Leave as `http://localhost:5173` for local use | Already set |
| `DATABASE_URL` | Leave as `"file:./dev.db"` | Already set |

For a first test, you can leave the empty keys blank and still install/run the UI — but **login and AI voice features will not work** until you add real values.

In `nano`:

1. Edit the values you have.
2. Save with **Ctrl+O**, then Enter.
3. Exit with **Ctrl+X**.

---

## Step 6 — Install project dependencies

Still inside the `neuspeak` folder:

```bash
npm ci
```

This reads `package-lock.json` and installs exact versions.  
The first run can take a few minutes.

If `npm ci` fails, try:

```bash
npm install
```

---

## Step 7 — Set up the local database

NeuSpeak uses a small SQLite database file for local development.

```bash
npx prisma generate
npx prisma migrate deploy
```

You should see messages that the Prisma client was generated and migrations were applied.  
A file named `dev.db` will appear in the project folder.

---

## Step 8 — Start NeuSpeak on localhost

```bash
npm run dev:host
```

(If `dev:host` is missing on your branch, use: `npm run dev -- --host 0.0.0.0 --port 5173`.)

Wait until you see something like:

```text
VITE v8.x.x  ready in ... ms
  ➜  Local:   http://localhost:5173/
```

**Leave this Terminal window open** while you use the app. Closing it stops the server.

---

## Step 9 — Open the app in your browser

1. Open Firefox, Chrome, or Chromium on Ubuntu.
2. Go to: **http://localhost:5173**

You should see the NeuSpeak login page (or be redirected there).

- To stop the server later: go back to the Terminal and press **Ctrl+C**.

---

## Step 10 — Next time you want to run it

Open Terminal and run:

```bash
cd ~/Desktop/neuspeak
# or: cd ~/Projects/neuspeak

nvm use 22
npm run dev:host
```

Then open **http://localhost:5173** again.

You do **not** need to clone again unless you delete the folder.

---

## Updating to the latest source code

When the team pushes new changes:

```bash
cd ~/Desktop/neuspeak   # or your Projects path
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev:host
```

---

## Common problems (beginner FAQ)

### “Permission denied” or “command not found: npm”

- Make sure you opened a **new** Terminal after installing nvm.
- Run `nvm use 22`, then try again.

### “Could not resolve host” / network errors

- Check that you are online.
- Corporate/school networks sometimes block GitHub; try another network.

### Port 5173 already in use

Another program (or an old NeuSpeak) is using that port. Stop it, or start on another port:

```bash
npm run dev -- --host 0.0.0.0 --port 5174
```

Then open **http://localhost:5174**.

### Login or voice features fail

Add real values to `.env` for:

- `OPENAI_API_KEY`
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

Then stop the server (**Ctrl+C**) and start it again with `npm run dev:host`.  
`.env` changes do not apply until you restart.

### “Repository not found” when cloning

The repo may be private. Sign in to the correct GitHub account, or ask the project owner for access, then clone again with a Personal Access Token.

---

## Quick checklist

- [ ] Ubuntu 26.04 LTS desktop (host OS)
- [ ] Terminal open
- [ ] `git` installed
- [ ] Node.js 22 installed (`node -v`)
- [ ] Project cloned (`neuspeak` folder exists)
- [ ] `.env` created from `.env.example`
- [ ] `npm ci` finished
- [ ] Prisma generate + migrate finished
- [ ] `npm run dev:host` shows Local URL
- [ ] Browser opens **http://localhost:5173**

---

## Where to get help

- Bug reporting tips: [`docs/debugging-guide.md`](./debugging-guide.md)
- API / voice architecture: [`docs/api-architecture.md`](./api-architecture.md)
- GitHub repo: https://github.com/Nueavenue/neuspeak
