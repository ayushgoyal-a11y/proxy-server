import http from 'http';
import https from 'https';
import net from 'net';
import { Buffer } from 'buffer';

const PORT = process.env.PROXY_PORT || 8080;
const PROXY_USERNAME = process.env.PROXY_USERNAME || 'admin';
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || 'secret';

// ─── Auth ────────────────────────────────────────────────────────────────────
function isAuthenticated(req) {
  console.log("Getting Auth Header");
  const authHeader = req.headers['proxy-authorization'];
  console.log({req})
  if (!authHeader?.startsWith('Basic ')) return false;

  const [username, password] = Buffer.from(authHeader.slice(6), 'base64')
    .toString()
    .split(':');

  return username === PROXY_USERNAME && password === PROXY_PASSWORD;
}

function sendAuthRequired(res) {
  console.log("Sending Auth Required");
  res.writeHead(407, {
    'Proxy-Authenticate': 'Basic realm="Proxy"',
    'Content-Type': 'text/plain',
  });
  res.end('Proxy authentication required');
}

// ─── HTTP requests (e.g. http://example.com) ─────────────────────────────────

function handleHttpRequest(req, res) {
    console.log(`[HTTP] ${req.method} ${req.url} — from ${req.socket.remoteAddress}`);
  if (!isAuthenticated(req)) return sendAuthRequired(res);

  console.log(`[HTTP] Proxying request to: ${req.url}`);
  const targetUrl = new URL(req.url);
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || 80,
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: { ...req.headers, host: targetUrl.host },
  };

  delete options.headers['proxy-authorization'];

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[HTTP] Request error:', err.message);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  req.pipe(proxyReq);
}

// ─── HTTPS CONNECT tunnel (e.g. https://example.com) ─────────────────────────

function handleConnectTunnel(req, clientSocket, head) {
  console.log(`[CONNECT] ${req.url} — from ${clientSocket.remoteAddress}`);
  // Parse auth from the CONNECT request headers
  const authHeader = req.headers['proxy-authorization'];
  console.log({authHeader})
  if (!authHeader?.startsWith('Basic ')) {
    console.log("Sending Auth Required 2");
    clientSocket.write(
      'HTTP/1.1 407 Proxy Authentication Required\r\n' +
      'Proxy-Authenticate: Basic realm="Proxy"\r\n\r\n'
    );
    return clientSocket.destroy();
  }

  const [username, password] = Buffer.from(authHeader.slice(6), 'base64')
    .toString()
    .split(':');

  if (username !== PROXY_USERNAME || password !== PROXY_PASSWORD) {
    clientSocket.write('HTTP/1.1 407 Proxy Authentication Required\r\n\r\n');
    return clientSocket.destroy();
  }

  const [hostname, port] = req.url.split(':');

  const serverSocket = net.connect(Number(port) || 443, hostname, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on('error', (err) => {
    console.error('[CONNECT] Tunnel error:', err.message);
    clientSocket.destroy();
  });

  clientSocket.on('error', (err) => {
    console.error('[CONNECT] Client error:', err.message);
    serverSocket.destroy();
  });
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = http.createServer(handleHttpRequest);
server.on('connect', handleConnectTunnel);

server.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  // console.log(`Credentials: ${PROXY_USERNAME}:${PROXY_PASSWORD}`);
});
