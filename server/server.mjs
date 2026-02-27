import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const settingsPath = process.env.SETTINGS_PATH || join(__dirname, 'settings.json');
const defaultPath = process.env.DEFAULT_SETTINGS_PATH || join(__dirname, 'default-settings.json');
const staticDirEnv = process.env.STATIC_DIR;
const defaultStaticDir = join(__dirname, '..', 'dist', 'moskee-status-page');

function resolveStaticDir() {
  const candidates = [staticDirEnv, defaultStaticDir, join(defaultStaticDir, 'browser')].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return staticDirEnv || defaultStaticDir;
}

const staticDir = resolveStaticDir();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const clients = new Set();

async function loadSettings() {
  if (!existsSync(settingsPath)) {
    const defaults = await readFile(defaultPath, 'utf8');
    await writeFile(settingsPath, defaults);
  }

  const raw = await readFile(settingsPath, 'utf8');
  return JSON.parse(raw);
}

let settings = await loadSettings();

function broadcast(nextSettings) {
  const payload = `data: ${JSON.stringify(nextSettings)}\n\n`;
  for (const res of clients) {
    res.write(payload);
  }
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

async function serveStatic(req, res) {
  if (!req.url || req.url.startsWith('/api')) {
    return false;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let filePath = join(staticDir, url.pathname);

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  if (!existsSync(filePath)) {
    filePath = join(staticDir, 'index.html');
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
    return true;
  } catch {
    res.writeHead(404);
    res.end();
    return true;
  }
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(404, corsHeaders);
    res.end();
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.url.startsWith('/api/stream')) {
    res.writeHead(200, {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    res.write(`data: ${JSON.stringify(settings)}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.url.startsWith('/api/settings')) {
    if (req.method === 'GET') {
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(settings));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', async () => {
        try {
          settings = JSON.parse(body);
          await writeFile(settingsPath, JSON.stringify(settings, null, 2));
          broadcast(settings);
          res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify(settings));
        } catch (error) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }
  }

  const handled = await serveStatic(req, res);
  if (!handled) {
    res.writeHead(404, corsHeaders);
    res.end();
  }
});

const port = Number(process.env.PORT || 3333);
server.listen(port, () => {
  console.log(`Settings server running on http://localhost:${port}`);
});
