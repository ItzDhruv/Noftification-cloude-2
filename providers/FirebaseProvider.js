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

      // Check if required config is present
      if (!this.config || !this.config.project_id || !this.config.private_key || !this.config.client_email) {
        logger.error('Firebase configuration is incomplete', {
          hasProjectId: !!this.config?.project_id,
          hasPrivateKey: !!this.config?.private_key,
          hasClientEmail: !!this.config?.client_email
        });
        this.enabled = false;
        return;
      }

      // Initialize Firebase Admin if not already initialized
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(this.config)
        });
        logger.info('Firebase app initialized');
      } else {
        logger.info('Firebase app already initialized');
      }
      
      this.initialized = true;
      logger.info('Firebase provider initialized successfully');
    } catch (error) {
      logger.error('Firebase initialization error:', {
        message: error.message,
        stack: error.stack,
        config: {
          project_id: this.config?.project_id,
          client_email: this.config?.client_email,
          hasPrivateKey: !!this.config?.private_key
        }
      });
      this.enabled = false;
      this.initialized = false;
    }
  }

  isEnabled() {
    return this.enabled && this.initialized;
  }

  canHandle(notification) {
    return !!(notification.token || notification.tokens || notification.topic);
  }

  async send(notification) {
    if (!this.enabled) {
      throw new Error('Firebase provider is not enabled');
    }

    if (!this.initialized) {
      throw new Error('Firebase provider is not initialized');
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
        data: notification.data ? Object.fromEntries(
          Object.entries(notification.data).map(([key, value]) => [key, String(value)])
        ) : {}
      };

      // Add image if provided
      if (notification.image) {
        message.notification.image = notification.image;
      }

      // Add platform-specific options
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
      logger.error('Firebase send error:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      throw new Error(`Firebase send failed: ${error.message}`);
    }
  }
}

module.exports = FirebaseProvider;