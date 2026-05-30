const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');

const isDev = !app.isPackaged;
const WS_PORT = 8765;
const PHONE_APP_URL = 'https://Amagar00.github.io/screencast';

let mainWindow;
let wss;
let desktopClient = null;
let phoneClient = null;

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function startSignalingServer() {
  wss = new WebSocketServer({ port: WS_PORT });

  wss.on('listening', async () => {
    const localIP = getLocalIP();
    const wsUrl = `ws://${localIP}:${WS_PORT}`;
    const connectUrl = `${PHONE_APP_URL}?ws=${encodeURIComponent(wsUrl)}`;

    const qrDataUrl = await QRCode.toDataURL(connectUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    });

    mainWindow?.webContents.send('server-ready', {
      ip: localIP,
      port: WS_PORT,
      wsUrl,
      connectUrl,
      qrDataUrl,
    });
  });

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      switch (msg.type) {
        case 'register':
          if (msg.role === 'desktop') {
            desktopClient = ws;
            ws._role = 'desktop';
            ws.send(JSON.stringify({ type: 'registered', role: 'desktop' }));
            if (phoneClient) {
              mainWindow?.webContents.send('phone-connected');
            }
          } else if (msg.role === 'phone') {
            phoneClient = ws;
            ws._role = 'phone';
            ws.send(JSON.stringify({ type: 'registered', role: 'phone' }));
            mainWindow?.webContents.send('phone-connected');
            desktopClient?.send(JSON.stringify({ type: 'phone-joined' }));
          }
          break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
          const target = ws._role === 'phone' ? desktopClient : phoneClient;
          target?.send(JSON.stringify(msg));
          break;

        case 'disconnect':
          if (ws._role === 'phone') {
            phoneClient = null;
            mainWindow?.webContents.send('phone-disconnected');
            desktopClient?.send(JSON.stringify({ type: 'phone-left' }));
          }
          break;
      }
    });

    ws.on('close', () => {
      if (ws._role === 'phone') {
        phoneClient = null;
        mainWindow?.webContents.send('phone-disconnected');
        desktopClient?.send(JSON.stringify({ type: 'phone-left' }));
      } else if (ws._role === 'desktop') {
        desktopClient = null;
      }
    });
  });

  wss.on('error', (err) => {
    mainWindow?.webContents.send('server-error', err.message);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0f172a',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#94a3b8',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  startSignalingServer();

  ipcMain.on('renderer-ready', () => {});
});

app.on('window-all-closed', () => {
  wss?.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
