import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function App() {
  const [serverInfo, setServerInfo] = useState(null);
  const [status, setStatus] = useState('starting'); // starting | waiting | connecting | streaming | error
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    window.electronAPI?.rendererReady();

    window.electronAPI?.onServerReady((data) => {
      setServerInfo(data);
      setStatus('waiting');
      connectWebSocket(data.wsUrl);
    });

    window.electronAPI?.onPhoneConnected(() => setStatus('connecting'));
    window.electronAPI?.onPhoneDisconnected(() => {
      setStatus('waiting');
      pcRef.current?.close();
      pcRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    });
    window.electronAPI?.onServerError((msg) => {
      setError(msg);
      setStatus('error');
    });
  }, []);

  function connectWebSocket(wsUrl) {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'register', role: 'desktop' }));
    };

    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'phone-joined') {
        setStatus('connecting');
        await startWebRTC(ws);
      }

      if (msg.type === 'answer') {
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      }

      if (msg.type === 'ice-candidate' && msg.candidate) {
        try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
      }

      if (msg.type === 'phone-left') {
        setStatus('waiting');
        pcRef.current?.close();
        pcRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
      }
    };

    ws.onerror = () => setError('WebSocket error');
    ws.onclose = () => setTimeout(() => connectWebSocket(wsUrl), 3000);
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
          <video ref={videoRef} autoPlay playsInline muted={false} className="stream-video" />
          <div className="stream-badge">
            <span className="dot live" />
            LIVE
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
              <p>Starting local server…</p>
            </div>
          )}

          {status === 'error' && (
            <div className="status-card error">
              <p>⚠ {error || 'Failed to start server'}</p>
              <p className="hint">Make sure port 8765 is free and try again.</p>
            </div>
          )}

          {(status === 'waiting' || status === 'connecting') && serverInfo && (
            <div className="connect-panel">
              <div className="qr-wrapper">
                <img src={serverInfo.qrDataUrl} alt="QR Code" className="qr-code" />
                <div className="qr-label">Scan with phone camera</div>
              </div>

              <div className="divider"><span>or open manually</span></div>

              <div className="manual-url">
                <code>{serverInfo.connectUrl}</code>
              </div>

              <div className="network-info">
                <div className="info-row">
                  <span className="info-label">PC IP</span>
                  <span className="info-val">{serverInfo.ip}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Port</span>
                  <span className="info-val">{serverInfo.port}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Status</span>
                  <span className={`info-val status-${status}`}>
                    {status === 'waiting' ? '⏳ Waiting for phone…' : '🔗 Phone detected, connecting…'}
                  </span>
                </div>
              </div>

              <p className="tip">📱 Both devices must be on the same WiFi / hotspot</p>
            </div>
          )}
        </div>
      )}

      {/* Hidden video element always mounted so ref is available */}
      {status !== 'streaming' && (
        <video ref={videoRef} autoPlay playsInline style={{ display: 'none' }} />
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
