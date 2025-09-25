const Joi = require('joi');

// Base notification schema
const notificationSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  body: Joi.string().min(1).max(2000).required(),
  image: Joi.string().uri().optional(),
  data: Joi.object().optional(),
  
  // Firebase specific
  token: Joi.string().optional(),
  tokens: Joi.array().items(Joi.string()).max(500).optional(),
  topic: Joi.string().optional(),
  android: Joi.object().optional(),
  apns: Joi.object().optional(),
  webpush: Joi.object().optional(),
  
  // OneSignal specific
  playerIds: Joi.array().items(Joi.string()).max(2000).optional(),
  segments: Joi.array().items(Joi.string()).optional(),
  
  // Pusher specific
  channel: Joi.string().optional(),
  event: Joi.string().optional()
}).custom((value, helpers) => {
  // At least one targeting method should be provided for Firebase or OneSignal
  const hasFirebaseTarget = value.token || value.tokens || value.topic;
  const hasOneSignalTarget = value.playerIds || value.segments;
  const hasPusherTarget = true; // Pusher always has defaults
  
  if (!hasFirebaseTarget && !hasOneSignalTarget && !hasPusherTarget) {
    return helpers.error('notification.targeting');
  }
  
  return value;
}).messages({
  'notification.targeting': 'Notification must have at least one valid targeting method (Firebase: token/tokens/topic, OneSignal: playerIds/segments, or Pusher: channel/event)'
});

// Schedule schema
const scheduleSchema = Joi.object({
  time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
    .messages({
      'string.pattern.base': 'Time must be in HH:MM format (24-hour)'
    }),
  timezone: Joi.string().default('UTC'),
  frequency: Joi.string().valid('once', 'daily').default('once')
});

// Options schema
const optionsSchema = Joi.object({
  provider: Joi.string().valid('firebase', 'onesignal', 'pusher').optional(),
  enableFailover: Joi.boolean().default(true),
  timeout: Joi.number().positive().max(30000).optional()
});

// Single notification request schema
const singleNotificationSchema = Joi.object({
  notification: notificationSchema.required(),
  options: optionsSchema.optional(),
  schedule: scheduleSchema.optional()
});

// Bulk notification request schema
const bulkNotificationSchema = Joi.object({
  notifications: Joi.array().items(notificationSchema).min(1).max(100).required(),
  options: optionsSchema.optional(),
  schedule: scheduleSchema.optional()
});

// Scheduled notification schema
const scheduledNotificationSchema = Joi.object({
  notification: notificationSchema.required(),
  schedule: scheduleSchema.required(),
  options: optionsSchema.optional()
});

// Validation middleware functions
const validateNotification = (req, res, next) => {
  const { error } = singleNotificationSchema.validate(req.body, { 
    abortEarly: false,
    allowUnknown: false 
  });
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }))
    });
  }
  next();
};

const validateBulkNotification = (req, res, next) => {
  const { error } = bulkNotificationSchema.validate(req.body, { 
    abortEarly: false,
    allowUnknown: false 
  });
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }))
    });
  }
  next();
};

const validateScheduledNotification = (req, res, next) => {
  const { error } = scheduledNotificationSchema.validate(req.body, { 
    abortEarly: false,
    allowUnknown: false 
  });
  
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }))
    });
  }
  next();
};

module.exports = {
  validateNotification,
  validateBulkNotification,
  validateScheduledNotification,
  notificationSchema,
  scheduleSchema,
  optionsSchema
};
