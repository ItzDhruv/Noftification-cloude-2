const FirebaseProvider = require('../providers/FirebaseProvider');
const OneSignalProvider = require('../providers/OneSignalProvider');
const PusherProvider = require('../providers/PusherProvider');
const providerConfig = require('../config/providerConfig');
const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.providers = [];
    this.initializeProviders();
  }

  initializeProviders() {
    const providers = [
      {
        class: FirebaseProvider,
        config: providerConfig.firebase,
        name: 'firebase'
      },
      {
        class: OneSignalProvider,
        config: providerConfig.onesignal,
        name: 'onesignal'
      },
      {
        class: PusherProvider,
        config: providerConfig.pusher,
        name: 'pusher'
      }
    ];

    this.providers = providers
      .filter(p => p.config.enabled)
      .map(p => ({
        instance: new p.class(p.config.config, p.config.enabled),
        priority: p.config.priority
      }))
      .sort((a, b) => a.priority - b.priority)
      .map(p => p.instance);

    logger.info(`Initialized ${this.providers.length} notification providers`);
  }

  async sendNotification(notification, options = {}) {
    if (this.providers.length === 0) {
      throw new Error('No notification providers available');
    }

    const errors = [];

    // If specific provider is requested
    if (options.provider) {
      const provider = this.providers.find(p => 
        p.getName().toLowerCase() === options.provider.toLowerCase()
      );
      
      if (!provider) {
        throw new Error(`Provider ${options.provider} not found or not enabled`);
      }

      try {
        const result = await provider.sendWithRetry(notification);
        return {
          success: true,
          results: [result],
          totalProviders: 1,
          successfulProviders: 1,
          failedProviders: 0
        };
      } catch (error) {
        throw new Error(`Failed to send via ${options.provider}: ${error.message}`);
      }
    }

    // Try providers in priority order - STOP ON FIRST SUCCESS
    for (const provider of this.providers) {
      if (!provider.isEnabled()) {
        logger.info(`Skipping disabled provider: ${provider.getName()}`);
        errors.push({
          provider: provider.getName(),
          error: 'Provider is disabled',
          skipped: true
        });
        continue;
      }

      // Check if provider can handle this notification
      if (!provider.canHandle(notification)) {
        logger.info(`Provider ${provider.getName()} cannot handle this notification type`);
        errors.push({
          provider: provider.getName(),
          error: 'Provider cannot handle this notification type',
          skipped: true
        });
        continue;
      }

      try {
        logger.info(`Attempting to send notification via ${provider.getName()}`);
        const result = await provider.sendWithRetry(notification);
        
        logger.info(`Successfully sent via ${provider.getName()} - stopping here`);
        
        // SUCCESS: Return immediately on first successful send
        return {
          success: true,
          results: [result],
          errors: errors.length > 0 ? errors : undefined,
          totalProviders: this.providers.filter(p => p.canHandle(notification)).length,
          successfulProviders: 1,
          failedProviders: errors.filter(e => !e.skipped).length,
          skippedProviders: errors.filter(e => e.skipped).length,
          usedProvider: provider.getName()
        };
      } catch (error) {
        logger.error(`Failed to send via ${provider.getName()}:`, error.message);
        errors.push({
          provider: provider.getName(),
          error: error.message,
          skipped: false
        });
        // Continue to next provider on failure
      }
    }

    // If we reach here, all providers failed
    const errorMessage = `All providers failed: ${errors.map(e => `${e.provider}: ${e.error}`).join('; ')}`;
    throw new Error(errorMessage);
  }

  async sendBulkNotifications(notifications, options = {}) {
    const results = [];
    let totalSuccessful = 0;
    let totalFailed = 0;

    for (let i = 0; i < notifications.length; i++) {
      const notification = notifications[i];
      
      try {
        logger.info(`Processing bulk notification ${i + 1}/${notifications.length}`);
        const result = await this.sendNotification(notification, options);
        
        results.push({
          index: i,
          notification: {
            title: notification.title,
            body: notification.body.substring(0, 50) + (notification.body.length > 50 ? '...' : '')
          },
          result: result,
          success: true
        });
        
        totalSuccessful++;
      } catch (error) {
        logger.error(`Failed to send bulk notification ${i + 1}:`, error.message);
        
        results.push({
          index: i,
          notification: {
            title: notification.title,
            body: notification.body.substring(0, 50) + (notification.body.length > 50 ? '...' : '')
          },
          error: error.message,
          success: false
        });
        
        totalFailed++;
      }
    }

    return {
      total: notifications.length,
      successful: totalSuccessful,
      failed: totalFailed,
      results: results
    };
  }

  getAvailableProviders() {
    return this.providers.map(provider => ({
      name: provider.getName(),
      enabled: provider.isEnabled(),
      priority: this.providers.indexOf(provider) + 1
    }));
  }

  updateProviderStatus(providerName, enabled) {
    const provider = this.providers.find(p => 
      p.getName().toLowerCase() === providerName.toLowerCase()
    );
    
    if (provider) {
      provider.enabled = enabled;
      logger.info(`Provider ${providerName} ${enabled ? 'enabled' : 'disabled'}`);
      return true;
    }
    
    return false;
  }

  // Method to validate notification against all providers
  validateNotificationForProviders(notification) {
    const validation = {
      valid: false,
      providers: [],
      errors: []
    };

    for (const provider of this.providers) {
      if (!provider.isEnabled()) continue;

      try {
        provider.validateNotification(notification);
        const canHandle = provider.canHandle(notification);
        
        validation.providers.push({
          name: provider.getName(),
          canHandle: canHandle,
          valid: true
        });

        if (canHandle) {
          validation.valid = true;
        }
      } catch (error) {
        validation.providers.push({
          name: provider.getName(),
          canHandle: false,
          valid: false,
          error: error.message
        });
        
        validation.errors.push({
          provider: provider.getName(),
          error: error.message
        });
      }
    }

    return validation;
  }
}

module.exports = NotificationService;