export function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'A record with this value already exists.' });
  }

  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Internal server error.',
  });
}
