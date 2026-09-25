/**
 * Dev-server proxy. CRA's `proxy` field in package.json is a literal URL, so it
 * cannot follow BACKEND_PORT and every /api/* call died whenever the backend
 * bound a port other than 3001 (ECONNREFUSED). This file resolves the backend
 * URL at start-up instead.
 *
 * Precedence:
 *   1. REACT_APP_API_URL / VITE_API_URL  (explicit full URL)
 *   2. http://127.0.0.1:$BACKEND_PORT    (matches start.sh)
 *   3. http://localhost:3001             (previous hardcoded fallback)
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

function backendUrl() {
  const explicit = process.env.REACT_APP_API_URL || process.env.VITE_API_URL;
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
    })
  );
};