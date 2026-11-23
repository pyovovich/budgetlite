const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');
const { createApp } = require('../src/app');
const { createStore } = require('../src/data/store');

const sample = {
  description: '  Compra de prueba  ',
  amount: 1200.35,
  category: 'Alimentación',
  date: '2024-02-29',
};

async function setup(context, options = {}) {
  const app = createApp({ store: createStore({ seed: false }), ...options });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  const base = `http://127.0.0.1:${server.address().port}`;
  return (path, options) => fetch(base + path, options);
}

function json(method, body) {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

async function expectError(response, status, code) {
  assert.equal(response.status, status);
  const payload = await response.json();
  assert.deepEqual(Object.keys(payload), ['error']);
  assert.deepEqual(Object.keys(payload.error).sort(), ['code', 'message']);
  assert.equal(payload.error.code, code);
  assert.ok(payload.error.message);
}

test('crea un gasto y lo devuelve al listar', async (context) => {
  const request = await setup(context);
  const response = await request('/api/expenses', json('POST', sample));
  assert.equal(response.status, 201);
  const { id, ...expense } = await response.json();
  assert.ok(id);
  assert.deepEqual(expense, { ...sample, description: 'Compra de prueba' });
  assert.deepEqual(await (await request('/api/expenses')).json(), [{ id, ...expense }]);
});

test('rechaza importes inválidos', async (context) => {
  const request = await setup(context);
  for (const amount of [0, -1, '10', null, true, 0.001, 1_000_000_000_001]) {
    await expectError(await request('/api/expenses', json('POST', { ...sample, amount })), 400, 'VALIDATION_ERROR');
  }
  const nonFinite = JSON.stringify({ ...sample, amount: 'OVERFLOW' }).replace('"OVERFLOW"', '1e999');
  await expectError(await request('/api/expenses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: nonFinite,
  }), 400, 'VALIDATION_ERROR');
  assert.deepEqual(await (await request('/api/expenses')).json(), []);
});

test('rechaza categorías, fechas, descripciones y estructuras inválidas', async (context) => {
  const request = await setup(context);
  for (const body of [
    { ...sample, category: 'Compras' },
    { ...sample, date: '2025-02-29' },
    { ...sample, date: '2024-02-30' },
    { ...sample, date: '2024-2-01' },
    { ...sample, description: ' ' },
    { ...sample, description: 99 },
    [],
    null,
  ]) {
    await expectError(await request('/api/expenses', json('POST', body)), 400, 'VALIDATION_ERROR');
  }
  await expectError(await request('/api/expenses', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  }), 400, 'INVALID_JSON');
  await expectError(await request('/api/expenses', { method: 'POST', body: 'texto' }), 415, 'UNSUPPORTED_MEDIA_TYPE');
});

test('elimina un gasto existente y devuelve 404 para un ID inexistente', async (context) => {
  const request = await setup(context);
  const { id } = await (await request('/api/expenses', json('POST', sample))).json();
  const response = await request(`/api/expenses/${id}`, { method: 'DELETE' });
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.deepEqual(await (await request('/api/expenses')).json(), []);
  await expectError(await request(`/api/expenses/${id}`, { method: 'DELETE' }), 404, 'NOT_FOUND');
});

test('filtra el listado por mes y categoría y valida los filtros', async (context) => {
  const request = await setup(context);
  for (const expense of [sample, { ...sample, category: 'Salud' }, { ...sample, date: '2024-03-01' }]) {
    assert.equal((await request('/api/expenses', json('POST', expense))).status, 201);
  }
  const result = await request('/api/expenses?month=2024-02&category=Alimentaci%C3%B3n');
  const expenses = await result.json();
  assert.equal(expenses.length, 1);
  assert.equal(expenses[0].date, sample.date);
  assert.equal(expenses[0].category, sample.category);
  await expectError(await request('/api/expenses?category=Inexistente'), 400, 'VALIDATION_ERROR');
  await expectError(await request('/api/expenses?month=2024-13'), 400, 'VALIDATION_ERROR');
  await expectError(await request('/api/summary?month=2024-02&month=2024-03'), 400, 'VALIDATION_ERROR');
});

test('calcula total mensual, saldo, categorías y evolución en centavos exactos', async (context) => {
  const request = await setup(context);
  for (const expense of [
    { ...sample, amount: 0.1 },
    { ...sample, amount: 0.2 },
    { ...sample, amount: 100, category: 'Salud', date: '2024-02-05' },
    { ...sample, amount: 80, date: '2024-03-01' },
  ]) {
    assert.equal((await request('/api/expenses', json('POST', expense))).status, 201);
  }

  const response = await request('/api/summary?month=2024-02');
  assert.equal(response.status, 200);
  const summary = await response.json();
  assert.equal(summary.totalSpent, 100.3);
  assert.equal(summary.budget, 350000);
  assert.equal(summary.balance, 349899.7);
  assert.equal(summary.expenseCount, 3);
  assert.deepEqual(summary.byCategory, [
    { category: 'Alimentación', amount: 0.3 },
    { category: 'Transporte', amount: 0 },
    { category: 'Servicios', amount: 0 },
    { category: 'Salud', amount: 100 },
    { category: 'Entretenimiento', amount: 0 },
    { category: 'Otros', amount: 0 },
  ]);
  assert.deepEqual(summary.byDay, [
    { date: '2024-02-05', amount: 100 },
    { date: '2024-02-29', amount: 0.3 },
  ]);
});

test('actualiza el presupuesto por mes y advierte cuando el uso supera el 80%', async (context) => {
  const request = await setup(context);
  const budget = { month: '2024-02', amount: 1500 };
  const updated = await request('/api/budget', json('PUT', budget));
  assert.equal(updated.status, 200);
  assert.deepEqual(await updated.json(), budget);
  assert.deepEqual(await (await request('/api/budget?month=2024-02')).json(), budget);
  assert.deepEqual(await (await request('/api/budget?month=2024-03')).json(), { month: '2024-03', amount: 350000 });
  await expectError(await request('/api/budget', json('PUT', { ...budget, amount: 0 })), 400, 'VALIDATION_ERROR');

  assert.equal((await request('/api/expenses', json('POST', { ...sample, amount: 1200 }))).status, 201);
  const summary = () => request('/api/summary?month=2024-02').then((response) => response.json());
  assert.equal((await summary()).percentUsed, 80);
  assert.equal((await summary()).overThreshold, false);

  assert.equal((await request('/api/expenses', json('POST', { ...sample, amount: 350.5 }))).status, 201);
  const over = await summary();
  assert.equal(over.percentUsed, 103.37);
  assert.equal(over.balance, -50.5);
  assert.equal(over.overThreshold, true);
});

test('reporta salud y disponibilidad por separado', async (context) => {
  let ready = true;
  const request = await setup(context, { isReady: () => ready });
  let response = await request('/readyz');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ready' });

  ready = false;
  response = await request('/readyz');
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'not_ready' });

  response = await request('/healthz');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('siembra 12 gastos del mes local sin usar fechas futuras', async (context) => {
  const store = createStore({ now: new Date('2024-03-01T01:00:00Z') });
  const request = await setup(context, { store });
  const expenses = await (await request('/api/expenses')).json();
  assert.equal(expenses.length, 12);
  assert.ok(expenses.every(({ date }) => date.startsWith('2024-02') && date <= '2024-02-29'));
});
