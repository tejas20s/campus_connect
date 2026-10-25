export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV !== 'production' || isClientError
      ? err.message || 'Internal server error'
      : 'Internal server error.',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}
