const byId = (id) => document.getElementById(id);
const monthInput = byId('month');
const categoryFilter = byId('filter');
const dashboard = byId('dashboard');
const statusMessage = byId('status');
const editBudget = byId('edit-budget');
const expenseDialog = byId('expense-dialog');
const budgetDialog = byId('budget-dialog');
const expenseForm = byId('expense-form');
const budgetForm = byId('budget-form');

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const number = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });
const dayFormat = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const argentinaDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const colors = ['#6f57d9', '#3f76c9', '#2b9476', '#c67c26', '#be5583', '#65748f'];

let summary;
let requestVersion = 0;
let editingMonth;
monthInput.value = argentinaDate.format().slice(0, 7);

async function api(path, { method = 'GET', body } = {}) {
  const options = { method };
  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`/api${path}`, options);
  if (response.status === 204) return;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error.message);
  return data;
}

function message(content = '', isError = false) {
  statusMessage.textContent = content;
  statusMessage.classList.toggle('error', isError);
}

function element(tag, content, className) {
  const node = document.createElement(tag);
  node.textContent = content;
  if (className) node.className = className;
  return node;
}

function svgElement(tag, attributes, content = '') {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (content) node.textContent = content;
  return node;
}

function fillCategories(categories) {
  const input = expenseForm.elements.category;
  if (input.options.length > 1) return;
  for (const { category } of categories) {
    for (const select of [categoryFilter, input]) {
      const option = element('option', category);
      option.value = category;
      select.append(option);
    }
  }
}

function renderCategoryChart({ byCategory, totalSpent }) {
  const rows = byCategory.map(({ category, amount }, index) => {
    const row = element('li', '');
    const track = element('span', '', 'track');
    const bar = element('span', '');
    track.setAttribute('aria-hidden', 'true');
    bar.style.width = totalSpent ? `${amount / totalSpent * 100}%` : '0%';
    bar.style.backgroundColor = colors[index];
    track.append(bar);
    row.append(element('span', category), track, element('span', money.format(amount), 'category-amount'));
    return row;
  });
  byId('categories').replaceChildren(...rows);
}

function renderDailyChart({ month, byDay }) {
  const container = byId('daily');
  if (!byDay.length) {
    container.replaceChildren(element('p', 'Todavía no hay gastos registrados en este mes.', 'muted'));
    return;
  }

  const amounts = new Map(byDay.map(({ date, amount }) => [Number(date.slice(-2)), amount]));
  const nextMonth = new Date(`${month}-01T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 0);
  const days = nextMonth.getUTCDate();
  const peak = Math.max(...amounts.values());
  const chart = svgElement('svg', {
    viewBox: '0 0 480 180',
    role: 'img',
    'aria-label': byDay.map(({ date, amount }) => `Día ${Number(date.slice(-2))}: ${money.format(amount)}`).join('. '),
  });

  const left = 78;
  const top = 13;
  const height = 132;
  const step = (472 - left) / days;

  for (const fraction of [1, 0.5, 0]) {
    const y = top + (1 - fraction) * height;
    chart.append(
      svgElement('line', { x1: left, y1: y, x2: 472, y2: y, class: 'chart-grid' }),
      svgElement('text', { x: left - 9, y: y + 4, 'text-anchor': 'end', class: 'chart-label' }, compact.format(peak * fraction)),
    );
  }

  for (const [day, amount] of amounts) {
    const barHeight = Math.max(2, amount / peak * height);
    const bar = svgElement('rect', {
      x: left + (day - 1) * step + step * 0.13,
      y: top + height - barHeight,
      width: step * 0.74,
      height: barHeight,
      rx: 2,
      class: 'chart-bar',
    });
    bar.append(svgElement('title', {}, `Día ${day}: ${money.format(amount)}`));
    chart.append(bar);
  }

  for (const day of [1, 5, 10, 15, 20, 25, days]) {
    chart.append(svgElement('text', {
      x: left + (day - 0.5) * step,
      y: 166,
      'text-anchor': 'middle',
      class: 'chart-label',
    }, day));
  }
  container.replaceChildren(chart);
}

function renderSummary(data) {
  byId('total').textContent = money.format(data.totalSpent);
  byId('budget').textContent = money.format(data.budget);
  byId('balance').textContent = money.format(data.balance);
  byId('balance').classList.toggle('negative', data.balance < 0);
  const percent = `${number.format(data.percentUsed)} %`;
  byId('percent').textContent = percent;
  byId('count').textContent = number.format(data.expenseCount);
  byId('budget-caption').textContent = `${money.format(data.totalSpent)} de ${money.format(data.budget)} · ${percent} utilizado`;
  const progress = byId('budget-progress');
  progress.value = Math.min(100, data.percentUsed);
  progress.setAttribute('aria-valuetext', percent);
  progress.classList.toggle('over', data.overThreshold);
  byId('budget-warning').hidden = !data.overThreshold;
  fillCategories(data.byCategory);
  renderCategoryChart(data);
  renderDailyChart(data);
}

function renderExpenses(expenses) {
  byId('results').textContent = expenses.length === 1 ? '1 movimiento' : `${expenses.length} movimientos`;
  const tbody = byId('expenses-body');
  if (!expenses.length) {
    const row = element('tr', '');
    const cell = element('td', 'No hay gastos para los filtros seleccionados.', 'empty');
    cell.colSpan = 5;
    row.append(cell);
    tbody.replaceChildren(row);
    return;
  }

  const rows = expenses.map((expense) => {
    const row = element('tr', '');
    const category = element('td', '');
    category.append(element('span', expense.category, 'badge'));
    const action = element('td', '');
    const button = element('button', '', 'icon-button');
    button.type = 'button';
    button.setAttribute('aria-label', `Eliminar ${expense.description}`);
    button.append(byId('delete-icon').content.cloneNode(true));
    button.addEventListener('click', () => removeExpense(expense, button));
    action.append(button);
    row.append(
      element('td', expense.description),
      category,
      element('td', dayFormat.format(new Date(expense.date))),
      element('td', money.format(expense.amount)),
      action,
    );
    return row;
  });
  tbody.replaceChildren(...rows);
}

async function reload() {
  const version = ++requestVersion;
  summary = undefined;
  editBudget.disabled = true;
  dashboard.setAttribute('aria-busy', 'true');

  const month = monthInput.value;
  const query = new URLSearchParams({ month });
  if (categoryFilter.value) query.set('category', categoryFilter.value);

  try {
    const [data, expenses] = await Promise.all([
      api(`/summary?month=${encodeURIComponent(month)}`),
      api(`/expenses?${query}`),
    ]);
    if (version !== requestVersion) return;
    renderSummary(data);
    renderExpenses(expenses);
    summary = data;
    editBudget.disabled = false;
  } catch (error) {
    if (version === requestVersion) {
      message(`No se pudo actualizar el panel. ${error.message}`, true);
    }
  } finally {
    if (version === requestVersion) dashboard.setAttribute('aria-busy', 'false');
  }
}

async function removeExpense(expense, button) {
  if (!summary || !window.confirm(`¿Eliminar el gasto “${expense.description}”?`)) return;
  button.disabled = true;
  try {
    await api(`/expenses/${encodeURIComponent(expense.id)}`, { method: 'DELETE' });
    message('Gasto eliminado.');
    await reload();
  } catch (error) {
    message(`No se pudo eliminar el gasto. ${error.message}`, true);
  } finally {
    button.disabled = false;
  }
}

function handleForm(form, dialog, save) {
  const errorMessage = form.querySelector('.form-error');
  const buttons = form.querySelectorAll('button');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    body.amount = Number(body.amount);
    errorMessage.textContent = '';
    buttons.forEach((button) => { button.disabled = true; });
    try {
      await save(body);
      dialog.close();
      await reload();
    } catch (error) {
      errorMessage.textContent = error.message;
    } finally {
      buttons.forEach((button) => { button.disabled = false; });
    }
  });
  form.querySelectorAll('.close-dialog').forEach((button) => {
    button.addEventListener('click', () => dialog.close());
  });
  dialog.addEventListener('cancel', (event) => {
    if (form.querySelector('button[type="submit"]').disabled) event.preventDefault();
  });
  dialog.addEventListener('close', () => { errorMessage.textContent = ''; });
}

byId('new-expense').addEventListener('click', () => {
  expenseForm.reset();
  const today = argentinaDate.format();
  expenseForm.elements.date.value = today.startsWith(monthInput.value) ? today : `${monthInput.value}-01`;
  expenseDialog.showModal();
});

editBudget.addEventListener('click', () => {
  editingMonth = summary.month;
  byId('budget-period').textContent = monthFormat.format(new Date(`${editingMonth}-01`));
  budgetForm.elements.amount.value = summary.budget;
  budgetDialog.showModal();
});

handleForm(expenseForm, expenseDialog, async (body) => {
  const expense = await api('/expenses', { method: 'POST', body });
  monthInput.value = expense.date.slice(0, 7);
  if (categoryFilter.value && categoryFilter.value !== expense.category) categoryFilter.value = '';
  message('Gasto registrado.');
});

handleForm(budgetForm, budgetDialog, async (body) => {
  await api('/budget', { method: 'PUT', body: { ...body, month: editingMonth } });
  message('Presupuesto actualizado.');
});

monthInput.addEventListener('change', () => {
  if (!monthInput.checkValidity()) {
    monthInput.value = summary?.month ?? argentinaDate.format().slice(0, 7);
  }
  message();
  reload();
});
categoryFilter.addEventListener('change', () => {
  message();
  reload();
});

function markCurrentSection() {
  const current = window.location.hash || '#panel';
  document.querySelectorAll('nav a').forEach((link) => {
    if (link.hash === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}

window.addEventListener('hashchange', markCurrentSection);
markCurrentSection();
reload();
