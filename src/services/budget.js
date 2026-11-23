const { randomUUID } = require('node:crypto');
const { CATEGORIES, DEFAULT_BUDGET_CENTS, today } = require('../data/store');
const { HttpError } = require('../middleware/errors');

const MAX_CENTS = 100_000_000_000_000;

function invalid(message) {
  return new HttpError(400, 'VALIDATION_ERROR', message);
}

function validateMonth(month) {
  if (typeof month !== 'string' || !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw invalid('El mes debe tener el formato AAAA-MM.');
  }
  return month;
}

function validateCategory(category) {
  if (!CATEGORIES.includes(category)) throw invalid('Seleccioná una categoría válida.');
}

function validateDate(date) {
  if (typeof date === 'string' && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(date)) {
    const parsed = new Date(date);
    if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date) return;
  }
  throw invalid('Ingresá una fecha real con el formato AAAA-MM-DD.');
}

function toCents(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > MAX_CENTS / 100) {
    throw invalid('El importe debe ser un número mayor que cero y de hasta 1 billón de pesos.');
  }

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(amount));
  if (!match) throw invalid('El importe admite hasta dos decimales.');
  const [, whole, fraction = ''] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

function requireObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalid('El cuerpo debe ser un objeto JSON.');
  }
}

function publicExpense({ amountCents, ...expense }) {
  return { ...expense, amount: amountCents / 100 };
}

function createBudgetService({ expenses, budgets }) {
  function matchingExpenses(month, category) {
    return [...expenses.values()].filter((expense) =>
      (month === undefined || expense.date.startsWith(month)) &&
      (category === undefined || expense.category === category));
  }

  function listExpenses({ month, category }) {
    if (month !== undefined) validateMonth(month);
    if (category !== undefined) validateCategory(category);
    return matchingExpenses(month, category)
      .sort((left, right) => right.date.localeCompare(left.date))
      .map(publicExpense);
  }

  function addExpense(body) {
    requireObject(body);
    const { description, amount, category, date } = body;
    if (typeof description !== 'string' || !description.trim() || description.trim().length > 120) {
      throw invalid('Ingresá una descripción de 1 a 120 caracteres.');
    }
    validateCategory(category);
    validateDate(date);
    const amountCents = toCents(amount);
    const spent = matchingExpenses(date.slice(0, 7)).reduce((sum, expense) => sum + expense.amountCents, 0);
    if (spent + amountCents > MAX_CENTS) throw invalid('El total mensual admite hasta 1 billón de pesos.');

    const id = randomUUID();
    const expense = { id, description: description.trim(), amountCents, category, date };
    expenses.set(id, expense);
    return publicExpense(expense);
  }

  function deleteExpense(id) {
    if (!expenses.delete(id)) throw new HttpError(404, 'NOT_FOUND', 'No se encontró el gasto.');
  }

  function getBudget(month = today().slice(0, 7)) {
    validateMonth(month);
    return { month, amount: (budgets.get(month) ?? DEFAULT_BUDGET_CENTS) / 100 };
  }

  function updateBudget(body) {
    requireObject(body);
    const month = validateMonth(body.month);
    const amountCents = toCents(body.amount);
    budgets.set(month, amountCents);
    return { month, amount: amountCents / 100 };
  }

  function getSummary(month = today().slice(0, 7)) {
    validateMonth(month);
    const monthly = matchingExpenses(month);
    const budget = budgets.get(month) ?? DEFAULT_BUDGET_CENTS;
    const categories = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
    const daily = new Map();
    let total = 0;

    for (const { amountCents, category, date } of monthly) {
      total += amountCents;
      categories[category] += amountCents;
      daily.set(date, (daily.get(date) ?? 0) + amountCents);
    }

    return {
      month,
      totalSpent: total / 100,
      budget: budget / 100,
      balance: (budget - total) / 100,
      percentUsed: Number((total / budget * 100).toFixed(2)),
      overThreshold: total > budget * 4 / 5,
      expenseCount: monthly.length,
      byCategory: Object.entries(categories).map(([category, cents]) => ({ category, amount: cents / 100 })),
      byDay: [...daily.keys()].sort().map((date) => ({ date, amount: daily.get(date) / 100 })),
    };
  }

  return { listExpenses, addExpense, deleteExpense, getBudget, updateBudget, getSummary };
}

module.exports = { createBudgetService };
