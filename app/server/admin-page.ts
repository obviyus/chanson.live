export const ADMIN_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>chanson.live admin</title>
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
      --border: rgba(255, 255, 255, 0.06);
      --border-accent: rgba(212, 168, 83, 0.3);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 16px; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    body {
      font-family: 'DM Sans', -apple-system, sans-serif;
      color: var(--text-primary);
      background: var(--bg-deep);
      min-height: 100vh;
      line-height: 1.5;
    }

    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
      opacity: 0.03;
      pointer-events: none;
      z-index: 1000;
    }

    .container { max-width: 1100px; margin: 0 auto; padding: 48px 32px 80px; }

    header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border);
    }

    .brand h1 {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 38px;
      font-weight: 400;
      letter-spacing: -0.02em;
      color: var(--text-primary);
      font-style: italic;
    }

    .brand p { font-size: 14px; color: var(--text-secondary); }

    .grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; }

    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
    }

    .card h2 {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--text-tertiary);
      margin-bottom: 16px;
    }

    .stack { display: grid; gap: 12px; }

    .input, .textarea {
      width: 100%;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 14px;
      color: var(--text-primary);
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s ease;
    }

    .input:focus, .textarea:focus { border-color: var(--border-accent); }
    .textarea { min-height: 72px; resize: vertical; }

    .btn {
      background: var(--accent);
      color: #1B1304;
      border: none;
      border-radius: 10px;
      padding: 10px 14px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      box-shadow: 0 8px 24px rgba(212, 168, 83, 0.2);
    }

    .btn.secondary {
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border);
      box-shadow: none;
    }

    .btn.small { padding: 6px 10px; font-size: 12px; }
    .btn:hover { transform: translateY(-1px); }

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-top: 1px solid var(--border);
      padding: 12px 0;
    }

    .row:first-child { border-top: none; padding-top: 0; }

    .meta {
      font-size: 12px;
      color: var(--text-secondary);
      font-family: 'JetBrains Mono', monospace;
    }

    .title {
      font-size: 15px;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .status { font-size: 12px; color: var(--text-tertiary); }

    .notice {
      background: rgba(212, 168, 83, 0.08);
      border: 1px solid var(--border-accent);
      padding: 10px 12px;
      border-radius: 10px;
      color: var(--text-secondary);
      font-size: 13px;
    }

    .actions { display: flex; gap: 8px; }

    .row-actions { display: flex; gap: 8px; }

    @media (max-width: 900px) {
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <h1>Chanson Admin</h1>
        <p>Blacklist queue + rotation. Uses producer key.</p>
      </div>
      <div class="actions">
        <a class="btn secondary" href="/">Back to radio</a>
      </div>
    </header>

    <div class="grid">
      <section class="card">
        <h2>Auth</h2>
        <div class="stack">
          <input id="token" class="input" type="password" placeholder="Producer key" />
          <div class="actions">
            <button id="saveToken" class="btn">Save key</button>
            <button id="refresh" class="btn secondary">Refresh</button>
          </div>
          <div id="authStatus" class="status">Not connected</div>
        </div>
      </section>

      <section class="card">
        <h2>Blacklist add</h2>
        <div class="stack">
          <input id="blacklistInput" class="input" placeholder="YouTube URL or video id" />
          <input id="blacklistReason" class="input" placeholder="Reason (optional)" />
          <button id="blacklistAdd" class="btn">Blacklist</button>
          <div id="blacklistStatus" class="status"></div>
        </div>
      </section>
    </div>

    <div class="grid" style="margin-top: 24px;">
      <section class="card">
        <h2>Queue</h2>
        <div id="queue" class="stack"></div>
      </section>

      <section class="card">
        <h2>Blacklist</h2>
        <div id="blacklist" class="stack"></div>
      </section>
    </div>

    <div class="grid" style="margin-top: 24px;">
      <section class="card">
        <h2>Rotation pool</h2>
        <div id="cache" class="stack"></div>
      </section>
    </div>
  </div>

  <script>
    const tokenInput = document.getElementById('token');
    const saveToken = document.getElementById('saveToken');
    const refreshBtn = document.getElementById('refresh');
    const authStatus = document.getElementById('authStatus');
    const queueEl = document.getElementById('queue');
    const blacklistEl = document.getElementById('blacklist');
    const blacklistInput = document.getElementById('blacklistInput');
    const blacklistReason = document.getElementById('blacklistReason');
    const blacklistAdd = document.getElementById('blacklistAdd');
    const blacklistStatus = document.getElementById('blacklistStatus');
    const cacheEl = document.getElementById('cache');

    const storageKey = 'chanson-admin-token';

    tokenInput.value = localStorage.getItem(storageKey) || '';

    function authHeaders() {
      const token = tokenInput.value.trim();
      if (!token) return {};
      return { Authorization: 'Bearer ' + token };
    }

    function setStatus(el, text) {
      el.textContent = text;
    }

    function renderQueue(queue) {
      queueEl.innerHTML = '';
      if (!queue.length) {
        queueEl.innerHTML = '<div class="notice">Queue is empty.</div>';
        return;
      }

      queue.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'row';

        const info = document.createElement('div');
        info.innerHTML =
          '<div class=\"title\">' +
          (item.title || 'Untitled') +
          '</div>' +
          '<div class=\"meta\">' +
          item.source_id +
          '</div>';

        const action = document.createElement('button');
        action.className = 'btn small';
        action.textContent = 'Blacklist';
        action.addEventListener('click', () => blacklistSource(item));

        row.appendChild(info);
        row.appendChild(action);
        queueEl.appendChild(row);
      });
    }

    function renderBlacklist(list) {
      blacklistEl.innerHTML = '';
      if (!list.length) {
        blacklistEl.innerHTML = '<div class="notice">No blacklisted items.</div>';
        return;
      }

      list.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'row';

        const info = document.createElement('div');
        const reason = item.reason ? ' · ' + item.reason : '';
        info.innerHTML =
          '<div class=\"title\">' +
          item.source_id +
          reason +
          '</div>' +
          '<div class=\"meta\">' +
          (item.source_url || 'no url') +
          '</div>';

        const action = document.createElement('button');
        action.className = 'btn secondary small';
        action.textContent = 'Remove';
        action.addEventListener('click', () => removeBlacklist(item.source_id));

        row.appendChild(info);
        row.appendChild(action);
        blacklistEl.appendChild(row);
      });
    }

    function formatBytes(bytes) {
      if (!Number.isFinite(bytes)) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = bytes;
      let unit = 0;
      while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
      }
      return size.toFixed(size >= 10 || unit === 0 ? 0 : 1) + ' ' + units[unit];
    }

    function formatAge(ms) {
      if (!Number.isFinite(ms)) return 'unknown';
      const minutes = Math.floor(ms / 60000);
      if (minutes < 60) return minutes + 'm ago';
      const hours = Math.floor(minutes / 60);
      if (hours < 48) return hours + 'h ago';
      const days = Math.floor(hours / 24);
      return days + 'd ago';
    }

    function renderCache(items) {
      cacheEl.innerHTML = '';
      if (!items.length) {
        cacheEl.innerHTML = '<div class="notice">No cached tracks.</div>';
        return;
      }

      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'row';

        const info = document.createElement('div');
        const title = item.title && item.title !== 'Unknown' ? item.title : item.source_id;
        const age = formatAge(Date.now() - item.mtime_ms);
        const size = formatBytes(item.size_bytes || 0);
        const detail =
          (item.uploader ? item.uploader + ' · ' : '') +
          item.source_id +
          ' · ' +
          size +
          ' · ' +
          age;
        info.innerHTML =
          '<div class="title">' +
          title +
          '</div>' +
          '<div class="meta">' +
          detail +
          '</div>';

        const action = document.createElement('button');
        action.className = item.blacklisted ? 'btn secondary small' : 'btn small';
        action.textContent = item.blacklisted ? 'Allow' : 'Blacklist';
        action.addEventListener('click', async () => {
          if (item.blacklisted) {
            await removeBlacklist(item.source_id);
          } else {
            blacklistInput.value = item.source_url || item.source_id;
            await addBlacklist();
          }
        });

        row.appendChild(info);
        row.appendChild(action);
        cacheEl.appendChild(row);
      });
    }

    async function loadQueue() {
      const res = await fetch('/api/queue');
      const data = await res.json();
      renderQueue(data.queue || []);
    }

    async function loadBlacklist() {
      const res = await fetch('/api/admin/blacklist', { headers: authHeaders() });
      if (!res.ok) {
        setStatus(authStatus, res.status === 401 ? 'Unauthorized' : 'Error loading blacklist');
        renderBlacklist([]);
        return;
      }
      const data = await res.json();
      renderBlacklist(data.blacklist || []);
      setStatus(authStatus, 'Connected');
    }

    async function loadCache() {
      const res = await fetch('/api/admin/cache', { headers: authHeaders() });
      if (!res.ok) {
        cacheEl.innerHTML = '<div class="notice">Unauthorized</div>';
        return;
      }
      const data = await res.json();
      renderCache(data.items || []);
    }

    async function blacklistSource(item) {
      blacklistInput.value = item.source_url || item.source_id;
      await addBlacklist();
    }

    async function addBlacklist() {
      const urlOrId = blacklistInput.value.trim();
      const reason = blacklistReason.value.trim();
      if (!urlOrId) return;

      const res = await fetch('/api/admin/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ url: /youtube\\.com|youtu\\.be|^https?:\\/\\//i.test(urlOrId) ? urlOrId : undefined, source_id: /youtube\\.com|youtu\\.be|^https?:\\/\\//i.test(urlOrId) ? undefined : urlOrId, reason: reason || undefined })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }));
        setStatus(blacklistStatus, data.error || 'Request failed');
        return;
      }

      blacklistInput.value = '';
      blacklistReason.value = '';
      setStatus(blacklistStatus, 'Blacklisted');
      await loadQueue();
      await loadBlacklist();
      await loadCache();
    }

    async function removeBlacklist(sourceId) {
      const res = await fetch('/api/admin/blacklist/' + sourceId, {
        method: 'DELETE',
        headers: authHeaders()
      });

      if (!res.ok) {
        setStatus(blacklistStatus, 'Remove failed');
        return;
      }

      setStatus(blacklistStatus, 'Removed');
      await loadBlacklist();
      await loadCache();
    }

    saveToken.addEventListener('click', async () => {
      localStorage.setItem(storageKey, tokenInput.value.trim());
      await loadBlacklist();
      await loadCache();
    });

    refreshBtn.addEventListener('click', async () => {
      await loadQueue();
      await loadBlacklist();
      await loadCache();
    });

    blacklistAdd.addEventListener('click', addBlacklist);

    loadQueue();
    loadBlacklist();
    loadCache();
  </script>
</body>
</html>`;
