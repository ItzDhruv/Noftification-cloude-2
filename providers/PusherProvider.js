const Pusher = require('pusher');
const BaseProvider = require('./BaseProvider');
const logger = require('../utils/logger');

class PusherProvider extends BaseProvider {
  constructor(config, enabled) {
    super('Pusher', config, enabled);
    if (enabled) {
      this.pusher = new Pusher({
        appId: config.appId,
        key: config.key,
        secret: config.secret,
        cluster: config.cluster,
        useTLS: true
      });
    }
  }

  canHandle(notification) {
    // Pusher can always handle notifications (has defaults)
    return true;
  }

  async send(notification) {
    if (!this.enabled) {
      throw new Error('Pusher provider is not available');
    }

    try {
      this.validateNotification(notification);

      const channel = notification.channel || 'notifications';
      const event = notification.event || 'new-notification';
      const payload = {
        title: notification.title,
        body: notification.body,
        image: notification.image,
        data: notification.data || {},
        timestamp: new Date().toISOString()
      };

      const result = await this.pusher.trigger(channel, event, payload);
      
      logger.info('Pusher notification sent successfully', { 
        channel, 
        event, 
        result 
      });

      return {
        success: true,
        provider: this.name,
        result: result,
        channel: channel,
        event: event,
        sentAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Pusher send error:', error);
      throw new Error(`Pusher send failed: ${error.message}`);
    }
  }
}

module.exports = PusherProvider;
