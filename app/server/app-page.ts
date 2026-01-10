export const APP_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>chanson.live</title>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-deep: #0A0A0A;
      --bg-surface: #111111;
      --bg-elevated: #1A1A1A;
      --bg-hover: #222222;
      --text-primary: #F5F0E8;
      --text-secondary: #8A857D;
      --text-tertiary: #5C5852;
      --accent: #D4A853;
      --accent-dim: rgba(212, 168, 83, 0.15);
      --accent-glow: rgba(212, 168, 83, 0.4);
      --border: rgba(255, 255, 255, 0.06);
      --border-accent: rgba(212, 168, 83, 0.3);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html {
      font-size: 16px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body {
      font-family: 'DM Sans', -apple-system, sans-serif;
      color: var(--text-primary);
      background: var(--bg-deep);
      min-height: 100vh;
      line-height: 1.5;
    }

    /* Subtle grain texture overlay */
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
      opacity: 0.03;
      pointer-events: none;
      z-index: 1000;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 48px 32px 80px;
    }

    /* Header */
    header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-bottom: 48px;
      padding-bottom: 32px;
      border-bottom: 1px solid var(--border);
    }

    .brand {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .brand h1 {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 42px;
      font-weight: 400;
      letter-spacing: -0.02em;
      color: var(--text-primary);
      font-style: italic;
    }

    .brand p {
      font-size: 14px;
      color: var(--text-secondary);
      letter-spacing: 0.01em;
    }

    /* Main grid */
    .main-grid {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 24px;
    }

    /* Cards */
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px;
      position: relative;
    }

    .card-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--text-tertiary);
      margin-bottom: 20px;
      display: block;
    }

    /* Now Playing Card */
    .now-playing {
      background: linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-elevated) 100%);
      border-color: var(--border-accent);
      overflow: hidden;
    }

    .now-playing::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
      opacity: 0.5;
    }

    .track-info {
      margin-bottom: 24px;
    }

    .track-title {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 28px;
      font-weight: 400;
      line-height: 1.2;
      margin-bottom: 8px;
      color: var(--text-primary);
    }

    .track-artist {
      font-size: 15px;
      color: var(--text-secondary);
    }

    /* Reactive Waveform Visualizer */
    .visualizer {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 3px;
      height: 48px;
      margin: 20px 0;
      padding: 0 4px;
    }

    .visualizer-bar {
      width: 4px;
      min-height: 3px;
      background: var(--accent);
      border-radius: 2px;
      transition: height 0.05s ease-out;
      opacity: 0.85;
    }

    .visualizer-bar.idle {
      animation: idlePulse 2s ease-in-out infinite;
    }

    @keyframes idlePulse {
      0%, 100% { height: 3px; opacity: 0.3; }
      50% { height: 8px; opacity: 0.5; }
    }

    /* Custom Audio Player - Simplified for live streams */
    .audio-player {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 20px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-bottom: 20px;
    }

    .play-btn {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: none;
      background: var(--accent);
      color: var(--bg-deep);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s ease;
    }

    .play-btn:hover {
      background: #E4B863;
      transform: scale(1.05);
      box-shadow: 0 4px 16px var(--accent-glow);
    }

    .play-btn:active {
      transform: scale(0.98);
    }

    .play-btn svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    .play-btn .icon-pause {
      display: none;
    }

    .play-btn.playing .icon-play {
      display: none;
    }

    .play-btn.playing .icon-pause {
      display: block;
    }

    .player-status {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .live-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #EF4444;
    }

    .live-badge::before {
      content: '';
      width: 6px;
      height: 6px;
      background: #EF4444;
      border-radius: 50%;
      animation: livePulse 1.5s ease-in-out infinite;
    }

    @keyframes livePulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .player-text {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .volume-control {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .volume-btn {
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s ease;
    }

    .volume-btn:hover {
      color: var(--text-primary);
    }

    .volume-btn svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }

    .volume-btn .icon-muted {
      display: none;
    }

    .volume-btn.muted .icon-volume {
      display: none;
    }

    .volume-btn.muted .icon-muted {
      display: block;
    }

    .volume-slider {
      width: 80px;
      height: 4px;
      -webkit-appearance: none;
      appearance: none;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 2px;
      cursor: pointer;
    }

    .volume-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--accent);
      cursor: pointer;
      transition: transform 0.15s ease;
    }

    .volume-slider::-webkit-slider-thumb:hover {
      transform: scale(1.15);
    }

    .volume-slider::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--accent);
      border: none;
      cursor: pointer;
    }

    /* Hide native audio element */
    audio {
      display: none;
    }

    /* Controls */
    .controls {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .btn {
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 500;
      padding: 12px 20px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      letter-spacing: 0.01em;
    }

    .btn-primary {
      background: var(--accent);
      color: var(--bg-deep);
    }

    .btn-primary:hover {
      background: #E4B863;
      box-shadow: 0 4px 20px var(--accent-glow);
    }

    .btn-secondary {
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
      border-color: rgba(255, 255, 255, 0.12);
    }

    .connection-status {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-tertiary);
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-tertiary);
    }

    .status-dot.connected {
      background: #4ADE80;
      box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
    }

    /* Queue */
    .queue-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .queue-empty {
      font-size: 14px;
      color: var(--text-tertiary);
      font-style: italic;
      padding: 20px 0;
    }

    .queue-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      background: var(--bg-elevated);
      border-radius: 8px;
      transition: background 0.15s ease;
      animation: fadeSlide 0.3s ease;
    }

    .queue-item:hover {
      background: var(--bg-hover);
    }

    @keyframes fadeSlide {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .queue-item-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .queue-item-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .queue-item-artist {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .queue-item-duration {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--text-tertiary);
      flex-shrink: 0;
    }

    /* Request section */
    .request-section {
      margin-top: 24px;
    }

    .request-form {
      display: flex;
      gap: 12px;
    }

    .input-wrapper {
      flex: 1;
      position: relative;
    }

    .text-input {
      width: 100%;
      padding: 14px 16px;
      font-family: 'DM Sans', sans-serif;
      font-size: 14px;
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-primary);
      transition: all 0.2s ease;
    }

    .text-input::placeholder {
      color: var(--text-tertiary);
    }

    .text-input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-dim);
    }

    .text-input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Footer info */
    .footer-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
    }

    .provider-status {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-tertiary);
    }

    /* Log */
    .log {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-tertiary);
      max-height: 120px;
      overflow-y: auto;
      padding: 12px;
      background: var(--bg-deep);
      border-radius: 6px;
      margin-top: 16px;
    }

    .log::-webkit-scrollbar {
      width: 4px;
    }

    .log::-webkit-scrollbar-track {
      background: transparent;
    }

    .log::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 2px;
    }

    .log-entry {
      padding: 4px 0;
      border-bottom: 1px solid var(--border);
    }

    .log-entry:last-child {
      border-bottom: none;
    }

    .log-error {
      color: #F87171;
    }

    /* Page load animation */
    @keyframes pageLoad {
      from {
        opacity: 0;
        transform: translateY(16px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    header { animation: pageLoad 0.5s ease 0.1s both; }
    .main-grid > *:nth-child(1) { animation: pageLoad 0.5s ease 0.2s both; }
    .main-grid > *:nth-child(2) { animation: pageLoad 0.5s ease 0.3s both; }
    .request-section { animation: pageLoad 0.5s ease 0.4s both; }

    /* Responsive */
    @media (max-width: 800px) {
      .container {
        padding: 32px 20px 60px;
      }

      .main-grid {
        grid-template-columns: 1fr;
      }

      header {
        flex-direction: column;
        align-items: flex-start;
        gap: 20px;
      }

      .brand h1 {
        font-size: 36px;
      }

      .track-title {
        font-size: 24px;
      }

      .controls {
        flex-direction: column;
        align-items: stretch;
      }

      .connection-status {
        margin-left: 0;
        justify-content: center;
        margin-top: 8px;
      }

      .request-form {
        flex-direction: column;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <h1>chanson.live</h1>
        <p>Shared low-latency radio — one room, one stream, everyone listening together</p>
      </div>
    </header>

    <div class="main-grid">
      <section class="card now-playing" aria-live="polite">
        <span class="card-label">Now Playing</span>
        <div class="track-info">
          <h2 class="track-title" id="nowTitle">Nothing queued</h2>
          <p class="track-artist" id="nowArtist">Drop a link to start the stream</p>
        </div>
        <div class="visualizer" id="visualizer" aria-hidden="true"></div>
        <audio id="audio"></audio>
        <div class="audio-player">
          <button class="play-btn" id="playBtn" aria-label="Play">
            <svg class="icon-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            <svg class="icon-pause" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          </button>
          <div class="player-status">
            <span class="live-badge">Live</span>
            <span class="player-text" id="playerText">Click play to listen</span>
          </div>
          <div class="volume-control">
            <button class="volume-btn" id="volumeBtn" aria-label="Mute">
              <svg class="icon-volume" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
              <svg class="icon-muted" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
            </button>
            <input type="range" class="volume-slider" id="volumeSlider" min="0" max="1" step="0.01" value="1" />
          </div>
        </div>
        <div class="controls">
          <button class="btn btn-primary" id="connectBtn">Connect & Play</button>
          <button class="btn btn-secondary" id="disconnectBtn">Disconnect</button>
          <div class="connection-status">
            <span class="status-dot" id="statusDot"></span>
            <span id="status">Disconnected</span>
          </div>
        </div>
      </section>

      <section class="card">
        <span class="card-label">Up Next</span>
        <div class="queue-list" id="queueList">
          <p class="queue-empty">Queue is empty</p>
        </div>
      </section>
    </div>

    <section class="card request-section">
      <span class="card-label">Request a Track</span>
      <form class="request-form" id="queueForm">
        <div class="input-wrapper">
          <input
            type="text"
            class="text-input"
            id="queueInput"
            placeholder="Paste a YouTube link..."
            autocomplete="off"
          />
        </div>
        <button class="btn btn-primary" type="submit">Add to Queue</button>
      </form>
      <div class="footer-info">
        <span class="provider-status" id="providerStatus">Provider: checking...</span>
      </div>
      <div class="log" id="log"></div>
    </section>
  </div>
  <script type="module">
    import * as mediasoupClient from 'https://esm.sh/mediasoup-client@3.18.3';

    // DOM Elements
    const logEl = document.getElementById('log');
    const statusEl = document.getElementById('status');
    const statusDotEl = document.getElementById('statusDot');
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

    // Custom player elements
    const visualizerEl = document.getElementById('visualizer');
    const playBtn = document.getElementById('playBtn');
    const playerTextEl = document.getElementById('playerText');
    const volumeBtn = document.getElementById('volumeBtn');
    const volumeSlider = document.getElementById('volumeSlider');

    // State
    let ws = null;
    let device = null;
    let transport = null;
    let consumer = null;
    let pendingDtlsCallback = null;
    let iceServers = [];
    let providerMode = 'local';
    let providerReady = true;

    // Audio visualization state
    let audioContext = null;
    let analyser = null;
    let dataArray = null;
    let animationId = null;
    let isPlaying = false;
    const BAR_COUNT = 32;

    // Initialize visualizer bars
    function initVisualizer() {
      visualizerEl.innerHTML = '';
      for (let i = 0; i < BAR_COUNT; i++) {
        const bar = document.createElement('div');
        bar.className = 'visualizer-bar idle';
        visualizerEl.appendChild(bar);
      }
    }

    // Set up Web Audio API for visualization
    function setupAudioAnalyser(stream) {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.7;

      source.connect(analyser);
      // Note: We don't connect to destination since audioEl handles playback

      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);

      // Remove idle class from bars
      const bars = visualizerEl.querySelectorAll('.visualizer-bar');
      bars.forEach(bar => bar.classList.remove('idle'));

      startVisualization();
    }

    function startVisualization() {
      if (animationId) cancelAnimationFrame(animationId);

      function draw() {
        animationId = requestAnimationFrame(draw);

        if (!analyser || !dataArray) return;

        analyser.getByteFrequencyData(dataArray);

        const bars = visualizerEl.querySelectorAll('.visualizer-bar');
        const step = Math.floor(dataArray.length / BAR_COUNT);

        bars.forEach((bar, i) => {
          // Sample frequency data with some smoothing
          const dataIndex = Math.min(i * step, dataArray.length - 1);
          const value = dataArray[dataIndex];

          // Map 0-255 to reasonable height (3px to 48px)
          const height = Math.max(3, (value / 255) * 48);
          bar.style.height = height + 'px';
        });
      }

      draw();
    }

    function stopVisualization() {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }

      // Reset bars to idle state
      const bars = visualizerEl.querySelectorAll('.visualizer-bar');
      bars.forEach(bar => {
        bar.style.height = '';
        bar.classList.add('idle');
      });
    }

    // Custom player controls
    function updatePlayButton() {
      if (isPlaying) {
        playBtn.classList.add('playing');
      } else {
        playBtn.classList.remove('playing');
      }
    }

    playBtn.addEventListener('click', async () => {
      if (audioEl.paused) {
        try {
          await audioEl.play();
        } catch (e) {
          writeLog('Playback failed: ' + e.message, true);
        }
      } else {
        audioEl.pause();
      }
    });

    audioEl.addEventListener('play', () => {
      isPlaying = true;
      updatePlayButton();
      playerTextEl.textContent = 'Listening now';
    });

    audioEl.addEventListener('pause', () => {
      isPlaying = false;
      updatePlayButton();
      playerTextEl.textContent = 'Paused';
    });

    // Volume controls
    volumeSlider.addEventListener('input', (e) => {
      audioEl.volume = e.target.value;
      updateVolumeIcon();
    });

    volumeBtn.addEventListener('click', () => {
      audioEl.muted = !audioEl.muted;
      updateVolumeIcon();
    });

    function updateVolumeIcon() {
      if (audioEl.muted || audioEl.volume === 0) {
        volumeBtn.classList.add('muted');
      } else {
        volumeBtn.classList.remove('muted');
      }
    }

    // Initialize
    initVisualizer();

    const configPromise = loadConfig();

    // Event listeners
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
      writeLog('Queued successfully');
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
      line.className = isError ? 'log-entry log-error' : 'log-entry';
      line.textContent = new Date().toLocaleTimeString() + ' — ' + text;
      logEl.appendChild(line);
      logEl.scrollTop = logEl.scrollHeight;
    }

    function setStatus(text, connected = false) {
      statusEl.textContent = text;
      if (connected) {
        statusDotEl.classList.add('connected');
      } else {
        statusDotEl.classList.remove('connected');
      }
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
      setStatus('Connecting...', false);
      const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(wsProtocol + '//' + location.host + '/ws');

      ws.onopen = () => {
        writeLog('WebSocket connected');
        setStatus('Connected', true);
        playerTextEl.textContent = 'Connecting to stream...';
        ws.send(JSON.stringify({ type: 'get_rtp_capabilities' }));
      };

      ws.onclose = () => {
        writeLog('WebSocket disconnected');
        setStatus('Disconnected', false);
        stopVisualization();
        playerTextEl.textContent = 'Disconnected';
        ws = null;
        device = null;
        transport = null;
      };

      ws.onerror = () => writeLog('WebSocket error', true);

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'client_count':
            writeLog('Listeners: ' + msg.count);
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
            stopVisualization();
            playerTextEl.textContent = 'Stream ended';
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

            // Set up audio visualizer
            setupAudioAnalyser(stream);

            try {
              await audioEl.play();
              setStatus('Playing', true);
            } catch {
              writeLog('Click play button to start audio', true);
            }
            break;
          }
          case 'now_playing':
            if (msg.track) {
              nowTitleEl.textContent = msg.track.title;
              nowArtistEl.textContent = msg.track.uploader ?? 'Unknown artist';
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
        const empty = document.createElement('p');
        empty.className = 'queue-empty';
        empty.textContent = 'Queue is empty';
        queueListEl.appendChild(empty);
        return;
      }
      queue.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'queue-item';
        item.style.animationDelay = (index * 0.05) + 's';

        const info = document.createElement('div');
        info.className = 'queue-item-info';

        const title = document.createElement('div');
        title.className = 'queue-item-title';
        title.textContent = (index + 1) + '. ' + track.title;

        const artist = document.createElement('span');
        artist.className = 'queue-item-artist';
        artist.textContent = track.uploader ?? 'Unknown';

        info.appendChild(title);
        info.appendChild(artist);

        const duration = document.createElement('span');
        duration.className = 'queue-item-duration';
        if (track.duration_sec) {
          const minutes = Math.floor(track.duration_sec / 60);
          const seconds = String(track.duration_sec % 60).padStart(2, '0');
          duration.textContent = minutes + ':' + seconds;
        } else {
          duration.textContent = '--:--';
        }

        item.appendChild(info);
        item.appendChild(duration);
        queueListEl.appendChild(item);
      });
    }

    // Auto-connect on load
    connect();
  </script>
</body>
</html>`;
