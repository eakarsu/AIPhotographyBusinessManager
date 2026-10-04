/**
 * Dev-server proxy. CRA's `proxy` field in package.json is a literal URL, so it
 * cannot follow BACKEND_PORT and every /api/* call died whenever the backend
 * bound a port other than 3001 (ECONNREFUSED). This file resolves the backend
 * URL at start-up instead.
 *
 * Browser API requests use relative /api URLs. The proxy target follows the
 * local backend port, independent of the public browser URL.
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

function backendUrl() {
  const explicit = process.env.API_PROXY_TARGET;
  if (explicit) return explicit.replace(/\/$/, '');
  const port = process.env.BACKEND_PORT || process.env.SERVER_PORT || '3001';
  return `http://127.0.0.1:${port}`;
}

module.exports = function (app) {
  const target = backendUrl();
  // eslint-disable-next-line no-console
  console.log(`[setupProxy] /api -> ${target}`);
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      logLevel: 'warn',
      onProxyReq(proxyReq, req) {
        try {
          if (req.headers.origin && new URL(req.headers.origin).host === req.headers.host) {
            proxyReq.removeHeader('origin');
          }
        } catch (_) {
          // Leave malformed or cross-origin requests for the backend CORS policy.
        }
      },
    })
  );
};
