# ScreenCast 📱→🖥

**Share your phone screen to your PC over local WiFi or hotspot — no internet required.**

Built with Electron + React (desktop), React PWA (phone), WebRTC (streaming), and WebSocket (local signaling).

---

## How It Works

```
Phone ──[WebRTC video]──▶ PC (Electron App)
         ▲                    │
         └──[WebSocket]───────┘
              (local network only)
```

1. PC app starts a local WebSocket server and shows a **QR code**
2. Phone scans QR code → opens the web app in browser
3. WebRTC peer-to-peer connection is established
4. Phone streams its screen → PC displays it fullscreen

---

## Platform Support

| Platform | Screen Share | Camera |
|----------|-------------|--------|
| Android (Chrome) | ✅ | ✅ |
| iOS (Safari) | ❌ (OS limit) | ✅ |
| PC (Windows) | Receives stream | — |

> iOS does not allow `getDisplayMedia` in any browser. Camera is used as fallback.

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/screencast.git
cd screencast
```

### 2. Update the GitHub Pages URL

In `desktop/src/main.js`, change:
```js
const PHONE_APP_URL = 'https://YOUR_GITHUB_USERNAME.github.io/screencast';
```

In `phone-app/vite.config.js`, change:
```js
base: '/screencast/',  // Must match your GitHub repo name
```

### 3. Install dependencies

```bash
cd desktop && npm install
cd ../phone-app && npm install
```

### 4. Run in development

**Terminal 1 — Phone app:**
```bash
cd phone-app
npm run dev
# Opens at http://localhost:5174
```

**Terminal 2 — Desktop app:**
```bash
cd desktop
npm run dev
# Starts Electron + Vite
```

> For local testing, the phone app URL in QR code will point to your local dev server. Update `PHONE_APP_URL` in `main.js` to `http://YOUR_PC_IP:5174` during dev.

---

## Deploy to GitHub

### Phone App → GitHub Pages (automatic)

1. Push code to `main` branch
2. Go to **Settings → Pages → Source → GitHub Actions**
3. The `deploy-phone.yml` workflow deploys automatically

### Desktop App → GitHub Releases

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers `build-desktop.yml` which builds `.exe` (Windows) and `.dmg` (macOS) and publishes them as a GitHub Release.

---

## Project Structure

```
screencast/
├── desktop/                  # Electron desktop app (PC)
│   ├── src/
│   │   ├── main.js           # Electron main process + WebSocket server
│   │   ├── preload.js        # IPC bridge
│   │   ├── renderer.jsx      # React UI (QR code display + video)
│   │   └── style.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── phone-app/                # React PWA (phone browser)
│   ├── src/
│   │   ├── App.jsx           # WebRTC screen capture + streaming
│   │   ├── main.jsx
│   │   └── style.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── .github/
    └── workflows/
        ├── deploy-phone.yml  # Auto-deploy phone app to GitHub Pages
        └── build-desktop.yml # Build .exe/.dmg on git tag
```

---

## Requirements

- **PC**: Windows 10/11, Node.js 18+
- **Phone**: Android (Chrome) or iOS (Safari) — must be on same WiFi/hotspot as PC
- **Network**: Both devices on same local network (WiFi router or mobile hotspot)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| QR code not working | Make sure phone and PC are on same WiFi |
| "Connection refused" | Check Windows Firewall — allow port `8765` |
| Black screen on phone | Grant screen capture permission when prompted |
| iOS not screen sharing | This is an OS limitation; camera mode is the only option |
