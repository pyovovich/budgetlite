const { randomUUID } = require('node:crypto');

const CATEGORIES = Object.freeze([
  'Alimentación', 'Transporte', 'Servicios', 'Salud', 'Entretenimiento', 'Otros',
]);

const DEFAULT_BUDGET_CENTS = 35_000_000;
const argentinaDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function today(now = new Date()) {
  return argentinaDate.format(now);
}

function createStore({ seed = true, now = new Date() } = {}) {
  const expenses = new Map();
  const budgets = new Map();

  if (seed) {
    const date = today(now);
    const month = date.slice(0, 7);
    const currentDay = Number(date.slice(8));
    const samples = [
      ['Supermercado semanal', 38_490, 'Alimentación', 1],
      ['Carga de SUBE', 8_000, 'Transporte', 2],
      ['Internet del hogar', 26_990, 'Servicios', 3],
      ['Farmacia', 12_350, 'Salud', 4],
      ['Café y medialunas', 6_800, 'Alimentación', 5],
      ['Cine', 13_500, 'Entretenimiento', 7],
      ['Verdulería', 9_850, 'Alimentación', 9],
      ['Electricidad', 32_640, 'Servicios', 12],
      ['Regalo de cumpleaños', 19_900, 'Otros', 15],
      ['Viaje en taxi', 11_200, 'Transporte', 18],
      ['Consulta odontológica', 45_000, 'Salud', 22],
      ['Cena con amigos', 24_500, 'Entretenimiento', 26],
    ];

    for (const [description, pesos, category, day] of samples) {
      const id = randomUUID();
      const expenseDate = `${month}-${String(Math.min(day, currentDay)).padStart(2, '0')}`;
      expenses.set(id, { id, description, amountCents: pesos * 100, category, date: expenseDate });
    }
  }

  return { expenses, budgets };
}

module.exports = { createStore, CATEGORIES, DEFAULT_BUDGET_CENTS, today };
