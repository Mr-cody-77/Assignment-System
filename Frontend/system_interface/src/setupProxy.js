const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  const nodePort = process.env.REACT_APP_NODE_PORT || '8000';
  app.use(
    '/api',
    createProxyMiddleware({
      target: `http://localhost:${nodePort}`,
      changeOrigin: true,
    })
  );
};
