function errorHandler(err, req, res, next) {
  try {
    const payload = {
      level: 'error',
      type: 'unhandled_error',
      request_id: req?.id,
      method: req?.method,
      path: req?.path,
      message: err?.message
    };
    console.error(JSON.stringify(payload));
  } catch (e) {
    console.error(err?.stack || String(err));
  }
  const status = Number(err?.status || 500);
  const code = status >= 400 && status < 600 ? status : 500;
  res.status(code).json({ message: code === 500 ? 'Internal Server Error' : (err?.message || 'Error') });
}

module.exports = errorHandler;
