export const APP_PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>chanson.live</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap');
    :root {
      --bg: #0a0b10;
      --bg-2: #111420;
      --panel: rgba(18, 20, 32, 0.9);
      --panel-2: rgba(26, 28, 42, 0.92);
      --text: #f8f7f4;
      --muted: #a3a6b2;
      --accent: #ff8a2b;
      --accent-2: #ffd36f;
      --line: rgba(255, 255, 255, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Space Grotesk', sans-serif;
      color: var(--text);
      background:
        radial-gradient(1200px 600px at 10% 10%, rgba(255, 138, 43, 0.18), transparent 60%),
        radial-gradient(900px 500px at 90% 0%, rgba(73, 97, 255, 0.16), transparent 55%),
        linear-gradient(160deg, var(--bg), var(--bg-2));
      min-height: 100vh;
    }
    .wrap {
      max-width: 980px;
      margin: 0 auto;
      padding: 32px 24px 48px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 28px;
    }
    .brand {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .brand h1 {
      margin: 0;
      font-size: 32px;
      letter-spacing: -0.04em;
    }
    .brand p {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
    }
    .live-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(255, 138, 43, 0.18);
      border: 1px solid rgba(255, 138, 43, 0.4);
    }
    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 0 0 12px rgba(255, 138, 43, 0.9);
      animation: pulse 1.6s infinite;
    }
    .grid {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 20px;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    }
    .panel strong {
      font-family: 'IBM Plex Mono', monospace;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 11px;
      color: var(--muted);
    }
    .now {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 220px;
      background: var(--panel-2);
      position: relative;
      overflow: hidden;
    }
    .now::after {
      content: '';
      position: absolute;
      inset: auto -20% -40% -20%;
      height: 120px;
      background: linear-gradient(90deg, transparent, rgba(255, 138, 43, 0.18), transparent);
      transform: rotate(-2deg);
    }
    .now h2 {
      margin: 0;
      font-size: 26px;
    }
    .now p {
      margin: 0;
      color: var(--muted);
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .btn {
      border: none;
      border-radius: 12px;
      padding: 12px 18px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      background: var(--accent);
      color: #0b0b0c;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 16px rgba(255, 138, 43, 0.3);
    }
    .btn.secondary {
      background: transparent;
      border: 1px solid var(--line);
      color: var(--text);
    }
    .status {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
      color: var(--muted);
    }
    .queue-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 14px;
    }
    .queue-item {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 12px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.04);
      animation: slideIn 0.4s ease;
    }
    .queue-item span {
      font-size: 13px;
      color: var(--muted);
    }
    .queue-title {
      font-weight: 600;
      font-size: 14px;
    }
    form {
      display: flex;
      gap: 10px;
      margin-top: 12px;
    }
    input[type="text"] {
      flex: 1;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: rgba(8, 10, 20, 0.8);
      color: var(--text);
      font-size: 14px;
    }
    .log {
      margin-top: 16px;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
      color: var(--muted);
      max-height: 140px;
      overflow-y: auto;
    }
    audio {
      width: 100%;
      margin-top: 8px;
    }
    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      70% { transform: scale(1.4); opacity: 0.6; }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes slideIn {
      from { transform: translateY(8px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @media (max-width: 880px) {
      .grid {
        grid-template-columns: 1fr;
      }
      header {
        flex-direction: column;
        align-items: flex-start;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      * { animation: none !important; transition: none !important; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="brand">
        <h1>chanson.live</h1>
        <p>Shared low-latency radio. Global room, single stream.</p>
      </div>
      <div class="live-chip"><span class="live-dot"></span> live</div>
    </header>
    <div class="grid">
      <section class="panel now" aria-live="polite">
        <strong>Now Playing</strong>
        <h2 id="nowTitle">Nothing queued</h2>
        <p id="nowArtist">Drop a link to start the stream</p>
        <audio id="audio" controls></audio>
        <div class="controls">
          <button class="btn" id="connectBtn">Connect & Play</button>
          <button class="btn secondary" id="disconnectBtn">Disconnect</button>
          <span class="status" id="status">Disconnected</span>
        </div>
      </section>
      <section class="panel">
        <strong>Queue</strong>
        <div class="queue-list" id="queueList"></div>
      </section>
    </div>
    <section class="panel" style="margin-top: 20px;">
      <strong>Request</strong>
      <form id="queueForm">
        <input type="text" id="queueInput" placeholder="Paste a YouTube link" />
        <button class="btn" type="submit">Add</button>
      </form>
      <div class="status" id="providerStatus">Provider: unknown</div>
      <div class="log" id="log"></div>
    </section>
  </div>
  <script type="module">
    import * as mediasoupClient from 'https://esm.sh/mediasoup-client@3.18.3';
    const logEl = document.getElementById('log');
    const statusEl = document.getElementById('status');
    const queueListEl = document.getElementById('queueList');
    const nowTitleEl = document.getElementById('nowTitle');
    const nowArtistEl = document.getElementById('nowArtist');
    const audioEl = document.getElementById('audio');
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const queueForm = document.getElementById('queueForm');
    const queueInput = document.getElementById('queueInput');
    const queueButton = queueForm.querySelector('button');
    const providerStatusEl = document.getElementById('providerStatus');
    let ws = null;
    let device = null;
    let transport = null;
    let consumer = null;
    let pendingDtlsCallback = null;
    let iceServers = [];
    let providerMode = 'local';
    let providerReady = true;
    const configPromise = loadConfig();
    connectBtn.addEventListener('click', () => connect());
    disconnectBtn.addEventListener('click', () => disconnect());
    queueForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const url = queueInput.value.trim();
      if (!url) return;
      queueInput.value = '';
      writeLog('Adding to queue...');
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!res.ok) {
        writeLog('Queue error: ' + await res.text(), true);
        return;
      }
      writeLog('Queued');
    });
    async function loadConfig() {
      try {
        const res = await fetch('/api/config');
        if (!res.ok) return;
        const config = await res.json();
        iceServers = config.ice_servers ?? [];
        if (config.provider) {
          providerMode = config.provider.mode ?? 'local';
          providerReady = Boolean(config.provider.ready);
          updateProviderUI();
        }
      } catch {
        // ignore
      }
    }
    function writeLog(text, isError = false) {
      const line = document.createElement('div');
      line.textContent = new Date().toLocaleTimeString() + ' ' + text;
      line.style.color = isError ? '#f87171' : '#a3a6b2';
      logEl.appendChild(line);
      logEl.scrollTop = logEl.scrollHeight;
    }
    function setStatus(text) {
      statusEl.textContent = text;
    }
    function updateProviderUI() {
      if (providerMode === 'external') {
        providerStatusEl.textContent = providerReady ? 'Provider: ready' : 'Provider: offline';
        queueInput.disabled = !providerReady;
        queueButton.disabled = !providerReady;
      } else {
        providerStatusEl.textContent = 'Provider: local';
        queueInput.disabled = false;
        queueButton.disabled = false;
      }
    }
    async function connect() {
      if (ws) return;
      await configPromise;
      setStatus('Connecting...');
      const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(wsProtocol + '//' + location.host + '/ws');
      ws.onopen = () => {
        writeLog('WebSocket connected');
        setStatus('Connected');
        ws.send(JSON.stringify({ type: 'get_rtp_capabilities' }));
      };
      ws.onclose = () => {
        writeLog('WebSocket disconnected');
        setStatus('Disconnected');
        ws = null;
        device = null;
        transport = null;
      };
      ws.onerror = () => writeLog('WebSocket error', true);
      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'client_count':
            writeLog('listeners: ' + msg.count);
            break;
          case 'rtp_capabilities':
            device = new mediasoupClient.Device();
            await device.load({ routerRtpCapabilities: msg.capabilities });
            ws.send(JSON.stringify({ type: 'create_transport' }));
            break;
          case 'transport_created': {
            const options = { ...msg.params };
            if (iceServers.length) options.iceServers = iceServers;
            transport = device.createRecvTransport(options);
            transport.on('connect', ({ dtlsParameters }, callback, errback) => {
              pendingDtlsCallback = { callback, errback };
              ws.send(JSON.stringify({ type: 'connect_transport', dtlsParameters }));
            });
            ws.send(JSON.stringify({ type: 'consume', rtpCapabilities: device.rtpCapabilities }));
            break;
          }
          case 'transport_connected':
            if (pendingDtlsCallback) {
              pendingDtlsCallback.callback();
              pendingDtlsCallback = null;
            }
            break;
          case 'producer_started':
            if (transport && device) {
              ws.send(JSON.stringify({ type: 'consume', rtpCapabilities: device.rtpCapabilities }));
            }
            break;
          case 'producer_closed':
            audioEl.srcObject = null;
            break;
          case 'consumed': {
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
              setStatus('Playing');
            } catch {
              writeLog('Click play on audio element', true);
            }
            break;
          }
          case 'now_playing':
            if (msg.track) {
              nowTitleEl.textContent = msg.track.title;
              nowArtistEl.textContent = msg.track.uploader ?? 'Unknown';
            } else {
              nowTitleEl.textContent = 'Nothing queued';
              nowArtistEl.textContent = 'Drop a link to start the stream';
            }
            break;
          case 'queue_update':
            renderQueue(msg.queue ?? []);
            break;
          case 'error':
            writeLog(msg.message, true);
            break;
          case 'provider_status':
            providerMode = msg.mode ?? 'local';
            providerReady = Boolean(msg.ready);
            updateProviderUI();
            break;
        }
      };
    }
    function disconnect() {
      if (ws) ws.close();
    }
    function renderQueue(queue) {
      queueListEl.innerHTML = '';
      if (!queue.length) {
        queueListEl.textContent = 'Queue is empty';
        return;
      }
      queue.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'queue-item';
        const left = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'queue-title';
        title.textContent = String(index + 1) + '. ' + track.title;
        const uploader = document.createElement('span');
        uploader.textContent = track.uploader ?? 'Unknown';
        left.appendChild(title);
        left.appendChild(uploader);
        const right = document.createElement('span');
        if (track.duration_sec) {
          const minutes = Math.floor(track.duration_sec / 60);
          const seconds = String(track.duration_sec % 60).padStart(2, '0');
          right.textContent = String(minutes) + ':' + seconds;
        } else {
          right.textContent = '--:--';
        }
        item.appendChild(left);
        item.appendChild(right);
        queueListEl.appendChild(item);
      });
    }
    connect();
  </script>
</body>
</html>`;
