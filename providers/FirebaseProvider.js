const admin = require('firebase-admin');
const BaseProvider = require('./BaseProvider');
const logger = require('../utils/logger');

class FirebaseProvider extends BaseProvider {
  constructor(config, enabled) {
    super('Firebase', config, enabled);
    this.initialized = false;
    this.init();
  }

  init() {
    try {
      if (!this.enabled) {
        logger.info('Firebase provider is disabled');
        return;
      }

      if (!admin.apps.length) {
        // Fix: replace \n with actual line breaks in privateKey
        const fixedConfig = {
          ...this.config,
          privateKey: this.config.privateKey.replace(/\\n/g, '\n')
        };

        admin.initializeApp({
          credential: admin.credential.cert(fixedConfig)
        });
      }

      this.initialized = true;
      logger.info('Firebase provider initialized successfully');
    } catch (error) {
      logger.error('Firebase initialization error:', error);
      this.enabled = false;
    }
  }

  canHandle(notification) {
    return !!(notification.token || notification.tokens || notification.topic);
  }

  async send(notification) {
    if (!this.enabled || !this.initialized) {
      throw new Error('Firebase provider is not available');
    }

    if (!this.canHandle(notification)) {
      throw new Error('Firebase requires token, tokens, or topic');
    }

    try {
      this.validateNotification(notification);

      const message = {
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data || {}
      };

      if (notification.image) message.notification.image = notification.image;
      if (notification.android) message.android = notification.android;
      if (notification.apns) message.apns = notification.apns;
      if (notification.webpush) message.webpush = notification.webpush;

      let result;
      if (notification.tokens && Array.isArray(notification.tokens)) {
        message.tokens = notification.tokens;
        result = await admin.messaging().sendMulticast(message);
      } else if (notification.token) {
        message.token = notification.token;
        result = await admin.messaging().send(message);
      } else if (notification.topic) {
        message.topic = notification.topic;
        result = await admin.messaging().send(message);
      }

      logger.info('Firebase notification sent successfully', { 
        messageId: result.messageId || `${result.successCount}/${result.failureCount}`,
        successCount: result.successCount,
        failureCount: result.failureCount
      });

      return {
        success: true,
        provider: this.name,
        result: result,
        sentAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Firebase send error:', error);
      throw new Error(`Firebase send failed: ${error.message}`);
    }
  }
}

module.exports = FirebaseProvider;
