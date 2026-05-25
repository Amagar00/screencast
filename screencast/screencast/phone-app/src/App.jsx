import React, { useEffect, useRef, useState } from 'react';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

export default function App() {
  const [status, setStatus] = useState('idle');
  // idle | connecting | ready | streaming | error | unsupported
  const [error, setError] = useState('');
  const [wsUrl, setWsUrl] = useState('');
  const [shareType, setShareType] = useState(isIOS ? 'camera' : 'screen');
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const previewRef = useRef(null);

  // Parse ?ws= from URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ws = params.get('ws');
    if (ws) {
      setWsUrl(ws);
      connect(ws);
    }
  }, []);

  function connect(url) {
    setStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'register', role: 'phone' }));
      setStatus('ready');
    };

    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'offer') {
        await handleOffer(msg.sdp, ws);
      }

      if (msg.type === 'ice-candidate' && msg.candidate) {
        try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch {}
      }
    };

    ws.onerror = () => { setError('Could not connect to PC. Make sure you\'re on the same WiFi.'); setStatus('error'); };
    ws.onclose = () => { if (status !== 'error') setStatus('idle'); };
  }

  async function handleOffer(sdp, ws) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        ws.send(JSON.stringify({ type: 'ice-candidate', candidate: e.candidate }));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setStatus('streaming');
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setStatus('ready');
        stopStream();
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // Add stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => pc.addTrack(t, streamRef.current));
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: 'answer', sdp: pc.localDescription }));
  }

  async function startSharing() {
    try {
      let stream;
      if (shareType === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30, max: 60 } },
          audio: true,
        });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: true,
        });
      }

      streamRef.current = stream;

      if (previewRef.current) {
        previewRef.current.srcObject = stream;
      }

      // If PC has already sent an offer, add tracks to peer connection
      if (pcRef.current && pcRef.current.signalingState !== 'closed') {
        stream.getTracks().forEach(t => pcRef.current.addTrack(t, stream));
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        wsRef.current?.send(JSON.stringify({ type: 'offer', sdp: pcRef.current.localDescription }));
      }

      stream.getTracks().forEach(t => {
        t.onended = () => stopStream();
      });

      setStatus('streaming');
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Permission denied. Please allow screen/camera access.');
      } else if (err.name === 'NotSupportedError') {
        setError('Screen sharing is not supported on this browser/OS.');
      } else {
        setError(err.message || 'Failed to capture screen');
      }
      setStatus('error');
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (previewRef.current) previewRef.current.srcObject = null;
    wsRef.current?.send(JSON.stringify({ type: 'disconnect' }));
    setStatus('ready');
  }

  function handleManualConnect(e) {
    e.preventDefault();
    if (wsUrl.trim()) connect(wsUrl.trim());
  }

  return (
    <div className="phone-app">
      <header className="header">
        <div className="logo">⬡ ScreenCast</div>
      </header>

      <main className="main">
        {status === 'idle' && (
          <div className="card">
            <h2>Connect to PC</h2>
            <p className="hint-text">Scan the QR code on your PC, or enter the address manually:</p>
            <form onSubmit={handleManualConnect} className="manual-form">
              <input
                className="ws-input"
                type="text"
                placeholder="ws://192.168.1.x:8765"
                value={wsUrl}
                onChange={e => setWsUrl(e.target.value)}
              />
              <button className="btn primary" type="submit">Connect</button>
            </form>
          </div>
        )}

        {status === 'connecting' && (
          <div className="card center">
            <div className="spinner" />
            <p>Connecting to PC…</p>
          </div>
        )}

        {(status === 'ready' || status === 'streaming') && (
          <div className="card">
            <div className="connected-badge">
              <span className="dot green" /> Connected to PC
            </div>

            {isIOS && (
              <div className="ios-notice">
                <span>⚠️</span>
                <p>iOS doesn't support screen sharing in browsers. Camera mode is used instead.</p>
              </div>
            )}

            {!isIOS && (
              <div className="share-type-toggle">
                <button
                  className={`toggle-btn ${shareType === 'screen' ? 'active' : ''}`}
                  onClick={() => setShareType('screen')}
                >📱 Screen</button>
                <button
                  className={`toggle-btn ${shareType === 'camera' ? 'active' : ''}`}
                  onClick={() => setShareType('camera')}
                >📷 Camera</button>
              </div>
            )}

            <video ref={previewRef} autoPlay playsInline muted className="preview-video" />

            {status === 'ready' && (
              <button className="btn primary large" onClick={startSharing}>
                {shareType === 'screen' ? '🖥 Start Screen Share' : '📷 Start Camera'}
              </button>
            )}

            {status === 'streaming' && (
              <>
                <div className="stream-status">
                  <span className="dot live" /> Streaming to PC
                </div>
                <button className="btn danger" onClick={stopStream}>⏹ Stop Sharing</button>
              </>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="card error-card">
            <p className="error-icon">⚠️</p>
            <p className="error-msg">{error}</p>
            <button className="btn primary" onClick={() => { setStatus('idle'); setError(''); }}>
              Try Again
            </button>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>📶 Make sure both devices are on the same WiFi or hotspot</p>
      </footer>
    </div>
  );
}
