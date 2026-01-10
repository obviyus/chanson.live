export const TEST_PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>chanson.live - Stream Test</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      max-width: 760px;
      margin: 40px auto;
      padding: 20px;
      background: #0c0c0f;
      color: #f5f5f7;
    }
    h1 { margin: 0 0 8px 0; }
    .subtitle { color: #9a9aa2; margin-bottom: 24px; }
    .status {
      padding: 12px 16px;
      border-radius: 8px;
      margin: 12px 0;
      font-size: 14px;
      border: 1px solid transparent;
    }
    .status.connected { background: #152b18; border-color: #2a5a31; }
    .status.disconnected { background: #2b1515; border-color: #5a2a2a; }
    .status.waiting { background: #2b2a15; border-color: #5a562a; }
    .now-playing {
      background: #14121f;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
      border: 1px solid #2a2340;
    }
    .now-playing h2 { margin: 0 0 4px 0; }
    .now-playing .artist { color: #9a9aa2; margin: 0; }
    button {
      background: #f97316;
      color: #0c0c0f;
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
    }
    button:hover { background: #fb923c; }
    #log {
      background: #0a0a0c;
      border: 1px solid #2a2a2f;
      border-radius: 8px;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      max-height: 280px;
      overflow-y: auto;
      margin-top: 20px;
    }
    .log-entry { margin: 4px 0; }
    .log-entry.error { color: #f87171; }
    .log-entry.success { color: #86efac; }
    audio { width: 100%; margin: 16px 0; }
    .client-count { color: #9a9aa2; font-size: 14px; }
  </style>
</head>
<body>
  <h1>chanson.live Stream Test</h1>
  <p class="subtitle">WebRTC audio playback</p>

  <div id="connectionStatus" class="status disconnected">Disconnected</div>

  <div class="now-playing" id="nowPlaying" style="display: none;">
    <h2 id="title">-</h2>
    <p class="artist" id="artist">-</p>
  </div>

  <div>
    <button id="connectBtn">Connect & Play</button>
  </div>

  <p class="client-count">Listeners: <span id="clientCount">0</span></p>

  <audio id="audio" controls></audio>

  <div id="log"></div>

  <script type="module">
    import * as mediasoupClient from 'https://esm.sh/mediasoup-client@3.18.3';

    const log = (msg, type = '') => {
      const el = document.getElementById('log');
      const entry = document.createElement('div');
      entry.className = 'log-entry ' + type;
      entry.textContent = new Date().toLocaleTimeString() + ' ' + msg;
      el.appendChild(entry);
      el.scrollTop = el.scrollHeight;
      console.log(msg);
    };

    const setStatus = (text, type) => {
      const el = document.getElementById('connectionStatus');
      el.textContent = text;
      el.className = 'status ' + type;
    };

    let ws = null;
    let device = null;
    let transport = null;
    let consumer = null;
    let pendingDtlsCallback = null;
    let iceServers = [];

    const audioEl = document.getElementById('audio');
    const connectBtn = document.getElementById('connectBtn');

    connectBtn.onclick = connect;

    const configPromise = loadConfig();

    async function loadConfig() {
      try {
        const res = await fetch('/api/config');
        if (!res.ok) return;
        const config = await res.json();
        iceServers = config.ice_servers ?? [];
      } catch {
        // ignore
      }
    }

    async function connect() {
      if (ws) {
        ws.close();
        return;
      }

      await configPromise;
      setStatus('Connecting...', 'waiting');
      const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(wsProtocol + '//' + location.host + '/ws');

      ws.onopen = () => {
        log('WebSocket connected', 'success');
        setStatus('Connected', 'connected');
        connectBtn.textContent = 'Disconnect';
        ws.send(JSON.stringify({ type: 'get_rtp_capabilities' }));
      };

      ws.onclose = () => {
        log('WebSocket disconnected');
        setStatus('Disconnected', 'disconnected');
        connectBtn.textContent = 'Connect & Play';
        ws = null;
        device = null;
        transport = null;
      };

      ws.onerror = () => log('WebSocket error', 'error');

      ws.onmessage = async (e) => {
        const msg = JSON.parse(e.data);
        log('Received: ' + msg.type);

        switch (msg.type) {
          case 'welcome':
            log('Client ID: ' + msg.id, 'success');
            break;

          case 'client_count':
            document.getElementById('clientCount').textContent = msg.count;
            break;

          case 'rtp_capabilities':
            device = new mediasoupClient.Device();
            await device.load({ routerRtpCapabilities: msg.capabilities });
            log('Device loaded', 'success');
            ws.send(JSON.stringify({ type: 'create_transport' }));
            break;

          case 'transport_created':
            const options = { ...msg.params };
            if (iceServers.length) options.iceServers = iceServers;
            transport = device.createRecvTransport(options);
            transport.on('connect', ({ dtlsParameters }, callback, errback) => {
              pendingDtlsCallback = { callback, errback };
              ws.send(JSON.stringify({ type: 'connect_transport', dtlsParameters }));
            });
            log('Transport created', 'success');
            ws.send(JSON.stringify({ type: 'consume', rtpCapabilities: device.rtpCapabilities }));
            break;

          case 'transport_connected':
            if (pendingDtlsCallback) {
              pendingDtlsCallback.callback();
              pendingDtlsCallback = null;
            }
            log('Transport connected', 'success');
            break;

          case 'producer_started':
            log('Producer started', 'success');
            if (transport && device) {
              ws.send(JSON.stringify({ type: 'consume', rtpCapabilities: device.rtpCapabilities }));
            }
            break;

          case 'producer_closed':
            log('Producer closed', 'error');
            audioEl.srcObject = null;
            break;

          case 'consumed':
            consumer = await transport.consume({
              id: msg.params.id,
              producerId: msg.params.producerId,
              kind: 'audio',
              rtpParameters: msg.params.rtpParameters,
            });
            const stream = new MediaStream([consumer.track]);
            audioEl.srcObject = stream;
            try {
              await audioEl.play();
              log('Audio playing', 'success');
              setStatus('Playing', 'connected');
            } catch {
              log('Click audio controls to play', 'error');
            }
            break;

          case 'now_playing':
            if (msg.track) {
              document.getElementById('nowPlaying').style.display = 'block';
              document.getElementById('title').textContent = msg.track.title;
              document.getElementById('artist').textContent = msg.track.uploader ?? '-';
            } else {
              document.getElementById('nowPlaying').style.display = 'none';
            }
            break;

          case 'error':
            log('Error: ' + msg.message, 'error');
            break;
        }
      };
    }

    setTimeout(connect, 400);
  </script>
</body>
</html>`;
