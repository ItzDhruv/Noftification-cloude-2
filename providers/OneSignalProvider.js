const axios = require('axios');
const BaseProvider = require('./BaseProvider');
const logger = require('../utils/logger');

class OneSignalProvider extends BaseProvider {
  constructor(config, enabled) {
    super('OneSignal', config, enabled);
    this.baseUrl = 'https://onesignal.com/api/v1';
  }

  canHandle(notification) {
    // OneSignal can always handle notifications (defaults to 'All' segment)
    return true;
  }

  async send(notification) {
    if (!this.enabled) {
      throw new Error('OneSignal provider is not available');
    }

    try {
      this.validateNotification(notification);

      const payload = {
        app_id: this.config.appId,
        headings: { en: notification.title },
        contents: { en: notification.body },
        data: notification.data || {}
      };

      // Set targeting
      if (notification.playerIds && notification.playerIds.length > 0) {
        payload.include_player_ids = notification.playerIds;
      } else if (notification.segments && notification.segments.length > 0) {
        payload.included_segments = notification.segments;
      } else {
        payload.included_segments = ['All'];
      }

      // Add image if provided
      if (notification.image) {
        payload.big_picture = notification.image;
        payload.large_icon = notification.image;
      }

      // Handle scheduling for OneSignal
      if (notification.sendAt) {
        payload.send_after = notification.sendAt;
      }

      const response = await axios.post(
        `${this.baseUrl}/notifications`,
        payload,
        {
          headers: {
            'Authorization': `Basic ${this.config.restApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('OneSignal notification sent successfully', { 
        id: response.data.id,
        recipients: response.data.recipients 
      });

      return {
        success: true,
        provider: this.name,
        result: response.data,
        sentAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('OneSignal send error:', error.response?.data || error.message);
      throw new Error(`OneSignal send failed: ${error.response?.data?.errors?.[0] || error.message}`);
    }
  }
}

module.exports = OneSignalProvider;

