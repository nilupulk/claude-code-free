> ⚠️ **DISCLAIMER: This project is for educational purposes only. Not for commercial use.** Use responsibly and at your own risk.

---

# 🚀 Claude Code Leaked (2026-03-31) - Free & Open Setup on your own PC or VPS

Run **Claude Code CLI** locally for **free** using [OpenRouter](https://openrouter.ai) with free AI models, or bring your own Anthropic API key for premium models like Claude Opus and Sonnet.

> Claude Code is Anthropic's powerful AI coding agent that can read, write, and execute code directly in your terminal — now accessible to everyone.

![Windows](https://img.shields.io/badge/Windows-0078D6?logo=windows&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)
![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)
![Runtime](https://img.shields.io/badge/Runtime-Bun-orange)
![Cost](https://img.shields.io/badge/Cost-Free-brightgreen)

---

## ✨ What Is This?

This is a modified version of Claude Code that works with **any AI model** through OpenRouter's free API. Instead of requiring a paid Anthropic subscription, you can run it with:

- 🆓 **Free models** via OpenRouter (Qwen, Gemini, Llama, etc.)
- 💰 **Premium models** via OpenRouter (Claude Opus, Sonnet, GPT-4, etc.)
- 🔑 **Direct Anthropic API** if you have your own API key

### What Can Claude Code Do?

- 📝 **Create files & projects** — "Build me a React todo app"
- 🐛 **Debug & fix code** — "Fix the bug in server.js"
- 🔍 **Read & understand codebases** — "Explain how auth works"
- 💻 **Run terminal commands** — Executes shell commands with your approval
- ♻️ **Refactor code** — "Convert this to TypeScript"

---

## 💻 Minimum Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **RAM** | 2 GB | 4 GB+ |
| **Disk** | 500 MB free | 1 GB+ free |
| **Internet** | Required | Stable broadband |
| **OS** | Windows 10+ / Ubuntu 20.04+ / Any Linux | Latest version |
| **Terminal** | PowerShell 5.1+ / Bash | PowerShell 7 / Zsh |

> 💡 Since AI processing happens in the cloud (via OpenRouter), you do **NOT** need a powerful GPU or CPU. Even a basic laptop or a $5/month VPS works great!

---

## 📋 Prerequisites

| Tool | Required | Purpose |
|------|----------|---------|
| **Bun** (JS runtime) | ✅ Yes | Runs Claude Code and the proxy |
| **Git** | ✅ Yes | Clone this repository |
| **OpenRouter Account** | ✅ For free usage | Provides free AI models |

---

## 🪟 Installation on Windows

### Step 1: Install Bun

Open **PowerShell** (Run as Administrator) and run:
```powershell
irm bun.sh/install.ps1 | iex
```
**Restart PowerShell** after installation. Verify:
```powershell
bun --version
```

### Step 2: Install Git

Download and install from [git-scm.com/downloads](https://git-scm.com/downloads). Use default settings.

### Step 3: Clone & Patch

```powershell
cd C:\
git clone https://github.com/nilupulk/claude-code-free.git
cd claude-code-free
powershell -ExecutionPolicy Bypass -File patch-cli.ps1
```

> 💡 Patches come **pre-applied** in this repo. The script will confirm "already applied" — that's normal! Only needed if you rebuild from source.

### Step 4: Get OpenRouter API Key

1. Go to [openrouter.ai](https://openrouter.ai) → Sign up (free)
2. Go to [openrouter.ai/keys](https://openrouter.ai/keys) → Create Key
3. Copy your key (starts with `sk-or-...`)

### Step 5: Start the Proxy (Terminal 1)

```powershell
cd C:\claude-code-free
$env:OPENROUTER_API_KEY="sk-or-YOUR-KEY-HERE"
& "$env:USERPROFILE\.bun\bin\bun.exe" openrouter-proxy.mjs
```

Keep this window open! ✅

### Step 6: Start Claude Code (Terminal 2)

Open a **new** PowerShell window:
```powershell
cd C:\your\project
$env:ANTHROPIC_BASE_URL="http://127.0.0.1:4000"
$env:ANTHROPIC_API_KEY="sk-ant-api03-dummy-key-000000000000000000000000000000000000000000000000AA"
& "$env:USERPROFILE\.bun\bin\bun.exe" C:\claude-code-free\dist\cli.mjs --dangerously-skip-permissions
```

🎉 **Done! Start coding!**

---

## 🐧 Installation on Linux / macOS

### Step 1: Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc   # or source ~/.zshrc
```

Verify:
```bash
bun --version
```

### Step 2: Install Git

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install git -y

# macOS
brew install git

# Fedora/RHEL
sudo dnf install git -y
```

### Step 3: Clone

```bash
cd ~
git clone https://github.com/nilupulk/claude-code-free.git
cd claude-code-free
```

> 💡 Patches are **pre-applied** in this repo. No additional patching needed! If you ever rebuild from source, use the sed commands in the [Troubleshooting](#-faq) section.

### Step 4: Get OpenRouter API Key

Same as Windows — get a free key from [openrouter.ai/keys](https://openrouter.ai/keys)

### Step 5: Start the Proxy (Terminal 1)

```bash
cd ~/claude-code-free
export OPENROUTER_API_KEY="sk-or-YOUR-KEY-HERE"
bun openrouter-proxy.mjs
```

### Step 6: Start Claude Code (Terminal 2)

Open a **new** terminal tab:
```bash
cd ~/your-project
export ANTHROPIC_BASE_URL="http://127.0.0.1:4000"
export ANTHROPIC_API_KEY="sk-ant-api03-dummy-key-000000000000000000000000000000000000000000000000AA"
bun ~/claude-code-free/dist/cli.mjs --dangerously-skip-permissions
```

🎉 **Done!**

---

## ☁️ Installation on a VPS (Ubuntu Server)

Perfect for running Claude Code on a remote server via SSH.

### Recommended VPS Specs

| Provider | Plan | Cost |
|----------|------|------|
| DigitalOcean | Basic Droplet (1 vCPU, 2GB RAM) | $6/mo |
| Hetzner | CX22 (2 vCPU, 4GB RAM) | €4/mo |
| AWS Lightsail | 2GB RAM | $10/mo |
| Any VPS | 2GB+ RAM, Ubuntu 22.04 | ~$5/mo |

### Step 1: SSH into your VPS

```bash
ssh root@your-server-ip
```

### Step 2: Install Dependencies

```bash
# Update system
apt update && apt upgrade -y

# Install Git
apt install git -y

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Verify
bun --version
```

### Step 3: Clone

```bash
cd /opt
git clone https://github.com/nilupulk/claude-code-free.git
cd claude-code-free
```

> 💡 Patches are **pre-applied**. Ready to use right after cloning!

### Step 4: Run with Screen/Tmux (Persistent Sessions)

Use `screen` or `tmux` so it keeps running after you disconnect:

```bash
# Install screen
apt install screen -y

# Start proxy in a screen session
screen -S proxy
export OPENROUTER_API_KEY="sk-or-YOUR-KEY-HERE"
bun /opt/claude-code-free/openrouter-proxy.mjs
# Press Ctrl+A, then D to detach

# Start Claude Code in another screen session
screen -S claude
cd /root/my-project
export ANTHROPIC_BASE_URL="http://127.0.0.1:4000"
export ANTHROPIC_API_KEY="sk-ant-api03-dummy-key-000000000000000000000000000000000000000000000000AA"
bun /opt/claude-code-free/dist/cli.mjs --dangerously-skip-permissions
```

### Reconnecting After Disconnect

```bash
ssh root@your-server-ip
screen -r claude   # Reattach to Claude Code
# or
screen -r proxy    # Reattach to proxy
```

🎉 **Now you have Claude Code running 24/7 on a VPS!**

---

## ⚡ Quick Start (One-Liner)

After initial setup, use this to start quickly:

**Terminal 1 — Proxy:**
```powershell
cd C:\claude-code-free; $env:OPENROUTER_API_KEY="sk-or-YOUR-KEY"; & "$env:USERPROFILE\.bun\bin\bun.exe" openrouter-proxy.mjs
```

**Terminal 2 — Claude Code:**
```powershell
cd C:\your\project; $env:ANTHROPIC_BASE_URL="http://127.0.0.1:4000"; $env:ANTHROPIC_API_KEY="sk-ant-api03-dummy-key-000000000000000000000000000000000000000000000000AA"; & "$env:USERPROFILE\.bun\bin\bun.exe" C:\claude-code-free\dist\cli.mjs --dangerously-skip-permissions
```

---

## 🎯 How to Use Claude Code

Once it launches, just type what you want in plain English:

### Creating Files
```
> create a landing page with HTML and CSS for a restaurant
> build a Node.js REST API with Express
> create a Python script that scrapes weather data
```

### Editing Code
```
> fix the bug in server.js
> add dark mode to my app
> refactor this to use async/await
```

### Running Commands
```
> install the dependencies and start the dev server
> run the tests
> create a git commit with a good message
```

### Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/model` | Change AI model |
| `/clear` | Clear conversation |
| `/compact` | Summarize context to save tokens |
| `/init` | Create CLAUDE.md memory file |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Escape` | Cancel current operation |
| `Ctrl+C` | Exit Claude Code |
| `y` / `yes` | Approve file changes or commands |

---

## 🔄 Changing Models

### Free Models (via OpenRouter)

Set the `OPENROUTER_MODEL` environment variable before starting the proxy:

```powershell
$env:OPENROUTER_MODEL="qwen/qwen3.6-plus-preview:free"    # Default, good quality
$env:OPENROUTER_MODEL="minimax/minimax-m2.5:free"          # Alternative
$env:OPENROUTER_MODEL="liquid/lfm-2.5-1.2b-instruct:free"  # Fastest
```

### Paid Models (via OpenRouter)

These require OpenRouter credits ([add credits here](https://openrouter.ai/credits)):

```powershell
$env:OPENROUTER_MODEL="anthropic/claude-sonnet-4-20250514"  # Claude Sonnet 4
$env:OPENROUTER_MODEL="anthropic/claude-opus-4-20250514"    # Claude Opus 4
$env:OPENROUTER_MODEL="openai/gpt-4o"                       # GPT-4o
$env:OPENROUTER_MODEL="google/gemini-2.5-pro-preview"       # Gemini 2.5 Pro
```

### Direct Anthropic API (No Proxy Needed)

If you have an Anthropic API key, skip the proxy entirely:

```powershell
cd C:\your\project
$env:ANTHROPIC_API_KEY="sk-ant-YOUR-REAL-KEY"
& "$env:USERPROFILE\.bun\bin\bun.exe" C:\claude-code-free\dist\cli.mjs
```

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Claude Code    │────▶│  OpenRouter      │────▶│  AI Model   │
│   (Bun CLI)      │◀────│  Proxy (Bun)     │◀────│  (Cloud)    │
│                  │     │  localhost:4000   │     │             │
│  Anthropic SDK   │     │  Translates:     │     │  Qwen 3.6   │
│  format          │     │  Anthropic ↔     │     │  Gemini     │
│                  │     │  OpenAI format   │     │  Claude     │
└─────────────────┘     └──────────────────┘     └─────────────┘
```

### How It Works

1. **Claude Code** sends requests in Anthropic API format (`/v1/messages`)
2. **OpenRouter Proxy** (`openrouter-proxy.mjs`) translates them to OpenAI format
3. **OpenRouter** routes the request to your chosen AI model
4. **Response** is translated back to Anthropic format and sent to Claude Code

The proxy handles:
- ✅ Message format translation
- ✅ Tool calls (file creation, shell commands, etc.)
- ✅ Streaming responses
- ✅ System prompts
- ✅ Multi-turn conversations

---

## ❓ FAQ

### General

**Q: Is this legal?**
A: This repository uses publicly available code. Use it responsibly and at your own risk.

**Q: Is it really free?**
A: Yes! OpenRouter offers several free AI models. You only pay if you choose premium models like Claude Opus or GPT-4.

**Q: How good are the free models?**
A: Free models (like Qwen 3.6) can handle basic coding tasks — creating files, simple apps, debugging. For complex projects, premium models perform much better.

### Setup Issues

**Q: `bun` is not recognized**
A: Restart PowerShell after installing Bun. If still failing, use the full path: `"$env:USERPROFILE\.bun\bin\bun.exe"`

**Q: "Version needs an update" error**
A: Run `powershell -ExecutionPolicy Bypass -File patch-cli.ps1` to apply patches.

**Q: "Unable to connect to API (ConnectionRefused)"**
A: The proxy isn't running. Make sure Terminal 1 (proxy) is open and showing the proxy banner.

**Q: "API Error: t.headers?.get is not a function"**
A: Run `patch-cli.ps1` again — the headers compatibility patch wasn't applied.

**Q: Claude Code asks me to log in**
A: Use `--dangerously-skip-permissions` flag and make sure `ANTHROPIC_API_KEY` is set (even to a dummy value).

**Q: The model is very slow**
A: You're likely using a local Ollama model on CPU. Switch to OpenRouter for cloud-based speed.

**Q: "f.render is not a function" error**
A: Run `patch-cli.ps1` — the syntax highlighter stubs need patching.

### Usage

**Q: Can I use this for any project?**
A: Yes! Just `cd` to your project folder before starting Claude Code.

**Q: Does it create real files?**
A: Yes! Claude Code creates, edits, and deletes real files on your system. Always review changes.

**Q: Can I use my own Anthropic API key?**
A: Yes! Set `ANTHROPIC_API_KEY` to your real key and skip the proxy entirely.

---

## 📁 Project Structure

```
claude-code-free/
├── dist/
│   └── cli.mjs              # Bundled Claude Code CLI (patched)
├── openrouter-proxy.mjs      # Anthropic ↔ OpenRouter translation proxy
├── patch-cli.ps1             # One-click patch script (Windows)
└── README.md                 # This file
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b my-feature`
3. Commit changes: `git commit -m 'Add my feature'`
4. Push: `git push origin my-feature`
5. Open a Pull Request

---

## ⭐ Star This Repo!

If this helped you, please give it a ⭐ on GitHub! It helps others discover this project.

---

## ⚠️ Disclaimer

This project is for educational purposes. Claude Code is a product of Anthropic. This repository provides tooling to make it accessible with alternative AI providers. Use responsibly and respect Anthropic's terms of service.
