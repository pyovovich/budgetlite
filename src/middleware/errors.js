class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const parserErrors = {
  'entity.parse.failed': [400, 'INVALID_JSON', 'El cuerpo debe ser un JSON válido.'],
  'request.aborted': [400, 'INVALID_REQUEST', 'La petición se interrumpió antes de completar el cuerpo.'],
  'request.size.invalid': [400, 'INVALID_REQUEST', 'El tamaño del cuerpo es inválido.'],
  'entity.too.large': [413, 'PAYLOAD_TOO_LARGE', 'El cuerpo de la petición es demasiado grande.'],
  'charset.unsupported': [415, 'UNSUPPORTED_MEDIA_TYPE', 'La codificación del cuerpo no es compatible.'],
  'encoding.unsupported': [415, 'UNSUPPORTED_MEDIA_TYPE', 'La codificación del cuerpo no es compatible.'],
};

function notFound(req, res, next) {
  next(new HttpError(404, 'NOT_FOUND', 'No se encontró la ruta solicitada.'));
}

function handleError(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  }

  if (Object.hasOwn(parserErrors, error.type)) {
    const [status, code, message] = parserErrors[error.type];
    return res.status(status).json({ error: { code, message } });
  }

  if (error instanceof URIError && error.status === 400) {
    return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'La URL contiene un parámetro inválido.' } });
  }

  console.error('Error al procesar la petición:', error);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' },
  });
}

module.exports = { HttpError, notFound, handleError };
