const { createApp } = require('./app');

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT debe ser un entero entre 0 y 65535.');
}

let ready = false;
let shuttingDown = false;
const app = createApp({ isReady: () => ready });
const server = app.listen(port, host, () => {
  if (shuttingDown) return;
  ready = true;
  console.log(`BudgetLite escucha en ${host}:${server.address().port}`);
});

server.on('error', (error) => {
  console.error('No se pudo iniciar el servidor:', error.message);
  process.exitCode = 1;
});

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  ready = false;
  console.log(`${signal} recibido. Cerrando el servidor HTTP…`);

  const timeout = setTimeout(() => {
    console.error('Se agotó el plazo de cierre. Se cerrarán las conexiones activas.');
    process.exitCode = 1;
    server.closeAllConnections();
  }, 10_000).unref();

  server.close((error) => {
    clearTimeout(timeout);
    if (error) {
      console.error('Error al cerrar el servidor:', error.message);
      process.exitCode = 1;
      return;
    }
    console.log('Servidor HTTP cerrado.');
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
