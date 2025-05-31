const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://26.34.237.219:8000',
      changeOrigin: true,
      secure: false,
    })
  );
};