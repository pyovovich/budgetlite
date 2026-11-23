const { Router } = require('express');
const { HttpError } = require('../middleware/errors');

function requireJson(req, res, next) {
  if (req.is('application/json') === false) {
    return next(new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Enviá el cuerpo como application/json.'));
  }
  return next();
}

function createApiRouter(service) {
  const router = Router();

  router.get('/expenses', (req, res) => res.json(service.listExpenses(req.query)));
  router.post('/expenses', requireJson, (req, res) => res.status(201).json(service.addExpense(req.body)));
  router.delete('/expenses/:id', (req, res) => {
    service.deleteExpense(req.params.id);
    res.status(204).end();
  });
  router.get('/summary', (req, res) => res.json(service.getSummary(req.query.month)));
  router.get('/budget', (req, res) => res.json(service.getBudget(req.query.month)));
  router.put('/budget', requireJson, (req, res) => res.json(service.updateBudget(req.body)));

  return router;
}

module.exports = { createApiRouter };
