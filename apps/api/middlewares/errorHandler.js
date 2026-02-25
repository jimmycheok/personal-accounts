import { ZodError } from 'zod';

export function errorHandler(err, req, res, next) {
  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: 'Validation error',
      details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return res.status(422).json({
      error: 'Database validation error',
      details: err.errors?.map(e => ({ field: e.path, message: e.message })),
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: err.message });
  }

  // Known HTTP errors
  if (err.status || err.statusCode) {
    const status = err.status || err.statusCode;
    return res.status(status).json({ error: err.message || 'Request error' });
  }

  // Unknown server errors
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { details: err.message, stack: err.stack } : {}),
  });
}

export function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
