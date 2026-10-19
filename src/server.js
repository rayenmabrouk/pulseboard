'use strict';

// PulseBoard - tableau de bord de statut stateless.
// Uniquement les modules natifs de Node.js : http, os, fs.

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');

const APP_NAME = 'PulseBoard';
const TAGLINE = 'PulseBoard — TP Déploiement Node.js / Docker / Kubernetes sur AWS';
const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const HOST = '0.0.0.0'; // accessible depuis l'extérieur du conteneur / de la VM

// Version lue une seule fois depuis package.json
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const VERSION = pkg.version;

// Compteur de requêtes propre à cette instance (pod)
let requestCount = 0;

// Formate une durée en secondes : "1j 2h 3m 4s"
function formatUptime(totalSeconds) {
  const s = Math.floor(totalSeconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [d && `${d}j`, (d || h) && `${h}h`, (d || h || m) && `${m}m`, `${sec}s`]
    .filter(Boolean)
    .join(' ');
}

// Informations communes au tableau de bord et à /api/info
function getInfo() {
  const uptime = process.uptime();
  return {
    app: APP_NAME,
    message: TAGLINE,
    version: VERSION,
    hostname: os.hostname(),
    nodeEnv: process.env.NODE_ENV || 'development',
    uptimeSeconds: Math.floor(uptime),
    uptime: formatUptime(uptime),
    serverTime: new Date().toISOString(),
    nodeVersion: process.version,
    requestCount,
  };
}

// Échappe les caractères HTML spéciaux
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function renderDashboard(info) {
  const rows = [
    ['Version', info.version],
    ['Hostname (Pod)', info.hostname],
    ['NODE_ENV', info.nodeEnv],
    ['Uptime', info.uptime],
    ['Heure du serveur', info.serverTime],
    ['Version de Node.js', info.nodeVersion],
    ['Requêtes (cette instance)', info.requestCount],
  ];

  const cards = rows
    .map(([label, value]) => `
      <div class="card">
        <span class="label">${escapeHtml(label)}</span>
        <span class="value">${escapeHtml(value)}</span>
      </div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${APP_NAME}</title>
  <style>
    :root {
      --bg: #0f1419; --panel: #182029; --border: #263241;
      --text: #e6edf3; --muted: #8b98a5; --accent: #3fb950; --accent2: #58a6ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; background: var(--bg); color: var(--text);
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      display: flex; justify-content: center; padding: 32px 16px;
    }
    main { width: 100%; max-width: 880px; }
    header { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
    .pulse {
      width: 14px; height: 14px; border-radius: 50%; background: var(--accent);
      box-shadow: 0 0 0 0 rgba(63, 185, 80, .7); animation: pulse 2s infinite;
    }
    @keyframes pulse {
      70% { box-shadow: 0 0 0 12px rgba(63, 185, 80, 0); }
      100% { box-shadow: 0 0 0 0 rgba(63, 185, 80, 0); }
    }
    h1 { margin: 0; font-size: 2rem; letter-spacing: -.02em; }
    .tagline { color: var(--muted); margin: 0 0 28px; }
    .grid {
      display: grid; gap: 14px;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }
    .card {
      background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
      padding: 16px 18px; display: flex; flex-direction: column; gap: 6px; min-width: 0;
    }
    .label { color: var(--muted); font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; }
    .value { font-size: 1.15rem; font-weight: 600; overflow-wrap: anywhere; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-top: 24px; }
    button {
      background: var(--accent2); color: #0b1220; border: 0; border-radius: 8px;
      padding: 10px 20px; font-size: 1rem; font-weight: 600; cursor: pointer;
    }
    button:hover { filter: brightness(1.1); }
    .note {
      color: var(--muted); font-size: .9rem; margin: 0;
      border-left: 3px solid var(--accent2); padding-left: 10px;
    }
    footer { margin-top: 32px; color: var(--muted); font-size: .8rem; }
    footer a { color: var(--accent2); }
  </style>
</head>
<body>
  <main>
    <header>
      <span class="pulse" aria-hidden="true"></span>
      <h1>${APP_NAME}</h1>
    </header>
    <p class="tagline">${escapeHtml(TAGLINE)}</p>

    <section class="grid">${cards}
    </section>

    <div class="actions">
      <button type="button" onclick="location.reload()">Rafraîchir</button>
      <p class="note">Chaque pod affiche son propre hostname : rafraîchissez la page
        pour observer la répartition de charge entre les réplicas.</p>
    </div>

    <footer>
      Endpoints : <a href="/health">/health</a> · <a href="/api/info">/api/info</a>
    </footer>
  </main>
</body>
</html>`;
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  requestCount += 1;
  const { pathname } = new URL(req.url, 'http://localhost');

  // Une ligne de log par requête, une fois la réponse envoyée
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${pathname} ${res.statusCode}`);
  });

  if (req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderDashboard(getInfo()));
  } else if (req.method === 'GET' && pathname === '/health') {
    sendJson(res, 200, {
      status: 'ok',
      app: APP_NAME,
      version: VERSION,
      hostname: os.hostname(),
      uptime: Math.floor(process.uptime()),
    });
  } else if (req.method === 'GET' && pathname === '/api/info') {
    sendJson(res, 200, getInfo());
  } else {
    sendJson(res, 404, { error: 'Not Found', path: pathname });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`${APP_NAME} v${VERSION} à l'écoute sur http://${HOST}:${PORT}`);
});

// Arrêt propre : Kubernetes envoie SIGTERM lors de la suppression d'un pod
function shutdown(signal) {
  console.log(`${signal} reçu, arrêt du serveur...`);
  server.close(() => {
    console.log('Serveur arrêté proprement.');
    process.exit(0);
  });
  server.closeIdleConnections();
  // Sécurité : forcer la sortie si des connexions restent ouvertes
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
