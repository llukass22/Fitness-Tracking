const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const { connectDatabase } = require('./db.cjs');
const { createLocalDatabase } = require('./local-db.cjs');
const { createApi } = require('./api.cjs');
let api;
const port = Number(process.env.PORT || 5173);
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/pwa.js': ['pwa.js', 'text/javascript; charset=utf-8'],
  '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
};
for (const icon of ['icon-192', 'icon-512', 'icon-maskable-512', 'apple-touch-icon']) {
  files[`/assets/icons/${icon}.png`] = [`assets/icons/${icon}.png`, 'image/png'];
}
for (const muscle of ['shoulders', 'chest', 'back', 'legs', 'core', 'arms', 'cardio', 'lat-pulldown', 'dumbbell-shrug', 'seated-cable-row', 'pull-up', 'plank', 'ab-rollout', 'russian-twists', 'leg-raises', 'crunches', 'mountain-climber', 'bicycle-crunches', 'leg-extension', 'leg-press', 'hack-squat', 'leg-curl', 'dumbbell-lunge', 'seated-calf-raise', 'dumbbell-press', 'dumbbell-lateral-raise', 'cable-lateral-raise', 'rear-delt-cable-fly', 'face-pull', 'dumbbell-upright-row', 'hammer-grip-shoulder-press', 'dumbbell-bench-press', 'machine-chest-press', 'dumbbell-fly', 'pec-deck-fly', 'low-cable-fly', 'high-cable-fly', 'push-ups', 'dumbbell-curl', 'cable-curl', 'barbell-curl', 'dumbbell-hammer-curl', 'cable-pushdown', 'cable-overhead-extension', 'dumbbell-triceps-kickback', 'incline-treadmill-walk', 'treadmill-run']) {
  files[`/assets/muscles/${muscle}.png`] = [`assets/muscles/${muscle}.png`, 'image/png'];
}

const server = http.createServer((request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'same-origin');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if ((request.url || '').startsWith('/api/')) return api(request, response);
  const file = files[(request.url || '/').split('?')[0]];
  if (!file || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  fs.readFile(path.join(__dirname, file[0]), (error, content) => {
    if (error) {
      response.writeHead(500);
      response.end('Unable to read file');
      return;
    }
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : content);
  });
});

server.on('error', (error) => {
  console.error(`Unable to start server: ${error.message}`);
  process.exit(1);
});

async function start() {
  const production = process.env.NODE_ENV === 'production';
  const databaseKeys = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const configuredKeys = databaseKeys.filter(key => process.env[key]);
  const localStorage = !production && configuredKeys.length === 0;
  const origin = process.env.APP_ORIGIN || `http://localhost:${port}`;
  if (production && (!process.env.APP_ORIGIN || !origin.startsWith('https://'))) throw new Error('Set APP_ORIGIN to your HTTPS domain in production.');
  if (new URL(origin).origin !== origin) throw new Error('APP_ORIGIN must be an origin without a trailing slash or path.');
  const db = localStorage ? createLocalDatabase() : await connectDatabase();
  api = createApi(db, { origin, secure: production, registration: process.env.ALLOW_REGISTRATION !== 'false' });
  server.listen(port, localStorage ? '127.0.0.1' : '0.0.0.0', () => {
    console.log(`Training journal listening at ${origin} (${localStorage ? 'local file storage' : 'MySQL/MariaDB'})`);
  });
}
start().catch(error => { console.error(error.message); process.exitCode = 1; });
