# BudgetLite

BudgetLite es un gestor local de gastos personales ficticios en pesos argentinos. El panel muestra el total gastado, el presupuesto, el saldo, el porcentaje utilizado y la cantidad de gastos del mes seleccionado. Incluye gráficos por categoría y por día, y una alerta cuando el consumo supera el 80% del presupuesto.

El listado admite filtros por mes y categoría. El filtro de categoría solo afecta el listado. Las tarjetas y los gráficos representan todo el mes seleccionado.

## Requisitos e instalación

- Node.js 22.13 o superior dentro de la rama 22, o Node.js 24.
- npm, incluido con Node.js.

```sh
npm ci
npm start
```

Abrí [http://127.0.0.1:3000](http://127.0.0.1:3000). El servidor escucha en la interfaz local IPv4. Podés cambiar el puerto con `PORT`. El modo de desarrollo reinicia el proceso al guardar cambios en el código de Node.js.

```sh
PORT=4000 npm start
npm run dev
```

## Pruebas y análisis estático

```sh
npm test
npm run lint
```

Las pruebas usan `node:test` y `node:assert/strict`. Cada prueba inicia su propia instancia de Express con un almacén aislado y un puerto local temporal.

## API REST

Las rutas de lectura devuelven JSON. Las escrituras con cuerpo requieren `Content-Type: application/json`. Los campos monetarios representan **pesos argentinos como números JSON**, con hasta dos decimales. La aplicación convierte los importes a centavos enteros antes de almacenarlos y calcular los totales.

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/expenses?month=YYYY-MM&category=Salud` | `200` con una lista ordenada por fecha descendente. Ambos filtros son opcionales. |
| POST | `/api/expenses` | `201` con el gasto creado. Recibe `description`, `amount`, `category` y `date`. |
| DELETE | `/api/expenses/:id` | `204` sin cuerpo. Devuelve `404` si el ID no existe. |
| GET | `/api/summary?month=YYYY-MM` | `200` con los totales, la distribución por categoría y los días con gastos. |
| GET | `/api/budget?month=YYYY-MM` | `200` con el mes y el importe de su presupuesto. |
| PUT | `/api/budget` | `200` con el presupuesto actualizado. Recibe `month` y `amount`. |
| GET | `/healthz` | `200` con `{"status":"ok"}` mientras el proceso atiende peticiones. |
| GET | `/readyz` | `200` con `{"status":"ready"}` cuando está disponible. Durante el apagado, las peticiones que todavía se atiendan reciben `503` con `{"status":"not_ready"}`. |

Las categorías aceptadas son Alimentación, Transporte, Servicios, Salud, Entretenimiento y Otros. El importe debe ser positivo y finito, la descripción debe tener de 1 a 120 caracteres después de quitar los espacios de los extremos, y la fecha debe ser una fecha real con formato `YYYY-MM-DD`. El máximo por importe y por total mensual es de ARS 1.000.000.000.000. Si se omite `month` al consultar el presupuesto o el resumen, se usa el mes actual de Buenos Aires.

### Ejemplos

Los siguientes ejemplos usan un mes histórico sin gastos iniciales, para que los valores sean reproducibles.

```sh
curl -sS http://127.0.0.1:3000/api/expenses \
  -H 'Content-Type: application/json' \
  -d '{"description":"Compra de almacén","amount":7850.5,"category":"Alimentación","date":"2025-04-07"}'
```

```json
{
  "id": "4a6d9b91-8368-40dc-98bf-16cefbeb816a",
  "description": "Compra de almacén",
  "category": "Alimentación",
  "date": "2025-04-07",
  "amount": 7850.5
}
```

```sh
curl -sS -X PUT http://127.0.0.1:3000/api/budget \
  -H 'Content-Type: application/json' \
  -d '{"month":"2025-04","amount":300000}'
```

```json
{"month":"2025-04","amount":300000}
```

```sh
curl -sS 'http://127.0.0.1:3000/api/summary?month=2025-04'
```

```json
{
  "month": "2025-04",
  "totalSpent": 7850.5,
  "budget": 300000,
  "balance": 292149.5,
  "percentUsed": 2.62,
  "overThreshold": false,
  "expenseCount": 1,
  "byCategory": [
    {"category":"Alimentación","amount":7850.5},
    {"category":"Transporte","amount":0},
    {"category":"Servicios","amount":0},
    {"category":"Salud","amount":0},
    {"category":"Entretenimiento","amount":0},
    {"category":"Otros","amount":0}
  ],
  "byDay": [{"date":"2025-04-07","amount":7850.5}]
}
```

Una consulta con un mes inválido devuelve `400`. El cuerpo de error sigue este formato.

```json
{"error":{"code":"VALIDATION_ERROR","message":"El mes debe tener el formato AAAA-MM."}}
```

## Arquitectura

- `src/app.js` configura Express, los endpoints de salud y los archivos estáticos.
- `src/server.js` inicia HTTP, controla la disponibilidad y gestiona el cierre ordenado con `SIGTERM` y `SIGINT`.
- `src/routes/` define las rutas REST.
- `src/services/` valida las entradas y calcula los resúmenes.
- `src/data/` mantiene el almacén y genera los datos de demostración.
- `src/middleware/` normaliza las respuestas de error.
- `public/` contiene HTML, CSS y JavaScript nativo. El panel usa `fetch()` con rutas relativas del mismo servidor y dibuja los gráficos con CSS y SVG.
- `tests/` contiene las pruebas HTTP de integración.

## Almacenamiento y alcance

Los gastos y presupuestos modificados se guardan en memoria y **se pierden al reiniciar**. Cada arranque genera 12 gastos ficticios del mes actual en la zona horaria de Buenos Aires. El presupuesto predeterminado de cada mes es de ARS 350.000 hasta que se modifique.

## Próximas etapas DevOps

1. Empaquetar la aplicación en Docker y automatizar las verificaciones y el despliegue con GitHub Actions.
2. Incorporar análisis de dependencias con Snyk y generación de un SBOM.
3. Aprovisionar el entorno de AWS con Terraform.
4. Instrumentar la aplicación con Prometheus y construir paneles en Grafana.
