class BaseProvider {
  constructor(name, config, enabled = true) {
    this.name = name;
    this.config = config;
    this.enabled = enabled;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  async send(notification) {
    throw new Error('Send method must be implemented by provider');
  }

  isEnabled() {
    return this.enabled;
  }

  getName() {
    return this.name;
  }

  validateNotification(notification) {
    if (!notification.title && !notification.body) {
      throw new Error('Notification must have either title or body');
    }
    return true;
  }

  async sendWithRetry(notification, attempts = this.retryAttempts) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.send(notification);
      } catch (error) {
        if (i === attempts - 1) {
          throw error;
        }
        await this.delay(this.retryDelay * (i + 1));
      }
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  canHandle(notification) {
    // Override in specific providers to check if they can handle the notification
    return true;
  }
}

module.exports = BaseProvider;
