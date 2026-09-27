const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.PORT || 5173);
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
};
for (const muscle of ['shoulders', 'chest', 'back', 'legs', 'core', 'arms', 'cardio']) {
  files[`/assets/muscles/${muscle}.png`] = [`assets/muscles/${muscle}.png`, 'image/png'];
}

const server = http.createServer((request, response) => {
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

server.listen(port, '0.0.0.0', () => {
  console.log(`Local: http://localhost:${port}`);
  console.log(`Mobile: http://192.168.1.152:${port}`);
});
