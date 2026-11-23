const path = require('node:path');
const express = require('express');
const { createStore } = require('./data/store');
const { createBudgetService } = require('./services/budget');
const { createApiRouter } = require('./routes/api');
const { notFound, handleError } = require('./middleware/errors');

function createApp({ store = createStore(), isReady = () => true } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
  app.get('/metrics', (req, res) => {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8').send([
      '# TYPE budgetlite_process_uptime_seconds gauge',
      `budgetlite_process_uptime_seconds ${process.uptime()}`,
      '# TYPE budgetlite_process_resident_memory_bytes gauge',
      `budgetlite_process_resident_memory_bytes ${process.memoryUsage.rss()}`,
      '',
    ].join('\n'));
  });
  app.get('/readyz', (req, res) => {
    const ready = isReady();
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });
  });

  app.use('/api', express.json({ limit: '16kb', strict: false }), createApiRouter(createBudgetService(store)));
  app.use(express.static(path.join(__dirname, '../public')));
  app.use(notFound);
  app.use(handleError);

  return app;
}

module.exports = { createApp };
