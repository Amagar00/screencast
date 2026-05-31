import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const WS_PORT = 8765;

function App() {
  const [status, setStatus] = useState('starting');
  const [serverInfo, setServerInfo] = useState(null);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    // Get local IP via WebSocket connection attempt
    detectAndConnect();
  }, []);

  async function detectAndConnect() {
    try {
      const res = await fetch('http://localhost:' + WS_PORT + '/info')
        .catch(() => null);
      
      // Just connect directly to localhost
      const wsUrl = `ws://localhost:${WS_PORT}`;
      setStatus('waiting');
      
      // Generate QR via API
      const ip = await getLocalIP();
      const connectUrl = `https://Amagar00.github.io/screencast?ws=${encodeURIComponent(`ws://${ip}:${WS_PORT}`)}`;
      
      setServerInfo({ ip, port: WS_PORT, connectUrl, wsUrl: `ws://${ip}:${WS_PORT}` });
      connectWebSocket(`ws://localhost:${WS_PORT}`);
    } catch(e) {
      setError(e.message);
      setStatus('error');
    }
  }

  async function getLocalIP() {
    return new Promise((resolve) => {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer().then(o => pc.setLocalDescription(o));
      pc.onicecandidate = (e) => {
        if (!e || !e.candidate) return;
        const match = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (match && !match[1].startsWith('127')) {
          resolve(match[1]);
          pc.close();
        }
      };
      setTimeout(() => resolve('localhost'), 3000);
    });
  }

  function connectWebSocket(wsUrl) {
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'register', role: 'desktop' }));
        setStatus('waiting');
      };

      ws.onmessage = async (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'phone-joined') {
          setStatus('connecting');
          await startWebRTC(ws);
        }
        if (msg.type === 'answer') {
          await pcRef.current?.setRemoteDescription(
            new RTCSessionDescription(msg.sdp)
          );
        }
        if (msg.type === 'ice-candidate' && msg.candidate) {
          try {
            await pcRef.current?.addIceCandidate(
              new RTCIceCandidate(msg.candidate)
            );
          } catch {}
        }
        if (msg.type === 'phone-left') {
          setStatus('waiting');
          pcRef.current?.close();
          pcRef.current = null;
          if (videoRef.current) videoRef.current.srcObject = null;
        }
      };

      ws.onerror = () => setError('WebSocket error');
      ws.onclose = () => {
        setTimeout(() => connectWebSocket(wsUrl), 3000);
      };
    } catch(e) {
      setError(e.message);
      setStatus('error');
    }
  }

  async function startWebRTC(ws) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.ontrack = (e) => {
      if (videoRef.current && e.streams[0]) {
        videoRef.current.srcObject = e.streams[0];
        setStatus('streaming');
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({ type: 'ice-candidate', candidate: e.candidate }));
      }
    };

    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription }));
  }

  return (
    <div className="app">
      {status === 'streaming' ? (
        <div className="stream-container">
          <video ref={videoRef} autoPlay playsInline className="stream-video" />
          <div className="stream-badge">
            <span className="dot live" /> LIVE
          </div>
        </div>
      ) : (
        <div className="waiting-screen">
          <div className="brand">
            <div className="brand-icon">⬡</div>
            <h1>ScreenCast</h1>
            <p className="brand-sub">Local screen mirroring over WiFi</p>
          </div>

          {status === 'starting' && (
            <div className="status-card">
              <div className="spinner" />
              <p>Starting...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="status-card error">
              <p>⚠ {error || 'Failed to start'}</p>
            </div>
          )}

          {(status === 'waiting' || status === 'connecting') && (
            <div className="connect-panel">
              {serverInfo && (
                <>
                  <div className="qr-wrapper">
                    <QRCodeDisplay url={serverInfo.connectUrl} />
                    <div className="qr-label">Scan with phone camera</div>
                  </div>
                  <div className="manual-url">
                    <code>{serverInfo.connectUrl}</code>
                  </div>
                  <div className="network-info">
                    <div className="info-row">
                      <span className="info-label">PC IP</span>
                      <span className="info-val">{serverInfo.ip}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Status</span>
                      <span className={`info-val status-${status}`}>
                        {status === 'waiting' ? '⏳ Waiting for phone…' : '🔗 Connecting…'}
                      </span>
                    </div>
                  </div>
                </>
              )}
              <p className="tip">📱 Both devices must be on the same WiFi</p>
            </div>
          )}
        </div>
      )}
      <video ref={videoRef} autoPlay playsInline
        style={{ display: status === 'streaming' ? 'none' : 'none' }} />
    </div>
  );
}

function QRCodeDisplay({ url }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    import('qrcode').then(QRCode => {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 220,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' }
      });
    });
  }, [url]);

  return <canvas ref={canvasRef} className="qr-code" />;
}

createRoot(document.getElementById('root')).render(<App />);
