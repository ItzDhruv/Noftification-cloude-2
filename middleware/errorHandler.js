const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  // Default error response
  let status = 500;
  let message = 'Internal Server Error';
  let details = {};

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation Error';
    details = { validation: err.message };
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid ID format';
  } else if (err.code === 11000) {
    status = 409;
    message = 'Duplicate field value';
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    message = 'Unauthorized';
  } else if (err.name === 'ForbiddenError') {
    status = 403;
    message = 'Forbidden';
  } else if (err.message && err.message.includes('timeout')) {
    status = 408;
    message = 'Request Timeout';
  } else if (err.message && err.message.includes('rate limit')) {
    status = 429;
    message = 'Rate Limit Exceeded';
  }

  const errorResponse = {
    success: false,
    message: message,
    error: {
      type: err.name || 'UnknownError',
      message: err.message,
      timestamp: new Date().toISOString(),
      requestId: req.id || 'unknown',
      ...details
    }
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }

  res.status(status).json(errorResponse);
};

module.exports = errorHandler;