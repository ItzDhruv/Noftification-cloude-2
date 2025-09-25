const cron = require('node-cron');
const moment = require('moment-timezone');
const logger = require('../utils/logger');

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.running = false;
  }

  start() {
    this.running = true;
    logger.info('Scheduler service started');
  }

  stop() {
    this.jobs.forEach((job, id) => {
      if (job.task && job.task.stop) {
        job.task.stop();
      }
      // Note: node-cron tasks don't have a destroy() method
    });
    this.jobs.clear();
    this.running = false;
    logger.info('Scheduler service stopped');
  }

  isRunning() {
    return this.running;
  }

  scheduleNotification(notification, schedule, notificationService, options = {}) {
    if (!this.running) {
      throw new Error('Scheduler service is not running');
    }

    const { time, timezone = 'UTC', frequency = 'once' } = schedule;
    
    // Validate time format (HH:MM)
    if (!time || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      throw new Error('Invalid time format. Use HH:MM format');
    }

    const [hours, minutes] = time.split(':').map(Number);
    
    // Generate unique job ID
    const jobId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let cronExpression;
    let scheduledFor;

    if (frequency === 'daily') {
      // Daily notification at specified time
      cronExpression = `${minutes} ${hours} * * *`;
      scheduledFor = 'daily';
    } else {
      // One-time notification - schedule for today or tomorrow
      const now = moment.tz(timezone);
      const targetTime = moment.tz(timezone).hours(hours).minutes(minutes).seconds(0);
      
      if (targetTime.isBefore(now)) {
        targetTime.add(1, 'day');
      }
      
      cronExpression = `${minutes} ${hours} ${targetTime.date()} ${targetTime.month() + 1} *`;
      scheduledFor = targetTime.format('YYYY-MM-DD HH:mm:ss z');
    }

    const task = cron.schedule(cronExpression, async () => {
      try {
        logger.info(`Executing scheduled notification: ${jobId}`);
        const result = await notificationService.sendNotification(notification, options);
        logger.info(`Scheduled notification sent successfully: ${jobId}`, { result });

        // Remove one-time jobs after execution
        if (frequency === 'once') {
          this.removeJob(jobId);
        }
      } catch (error) {
        logger.error(`Failed to send scheduled notification: ${jobId}`, error);
        
        // Remove failed one-time jobs
        if (frequency === 'once') {
          this.removeJob(jobId);
        }
      }
    }, {
      scheduled: false,
      timezone: timezone
    });

    // Store job details
    this.jobs.set(jobId, {
      id: jobId,
      notification: {
        title: notification.title,
        body: notification.body.substring(0, 100)
      },
      schedule: {
        time,
        timezone,
        frequency,
        cronExpression,
        scheduledFor
      },
      task: task,
      createdAt: new Date().toISOString(),
      options
    });

    // Start the job
    task.start();

    logger.info(`Notification scheduled: ${jobId}`, {
      time,
      timezone,
      frequency,
      scheduledFor
    });

    return {
      jobId,
      scheduledFor,
      frequency,
      timezone,
      cronExpression
    };
  }

  removeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      if (job.task && job.task.stop) {
        job.task.stop();
      }
      // node-cron doesn't have destroy method, just stop
      this.jobs.delete(jobId);
      logger.info(`Scheduled job removed: ${jobId}`);
      return true;
    }
    return false;
  }

  getJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    return {
      id: job.id,
      notification: job.notification,
      schedule: job.schedule,
      createdAt: job.createdAt,
      status: job.task && job.task.getStatus ? job.task.getStatus() : 'unknown'
    };
  }

  getActiveJobs() {
    return Array.from(this.jobs.values()).map(job => ({
      id: job.id,
      notification: job.notification,
      schedule: job.schedule,
      createdAt: job.createdAt,
      status: job.task && job.task.getStatus ? job.task.getStatus() : 'unknown'
    }));
  }

  // Validate schedule format
  validateSchedule(schedule) {
    if (!schedule || typeof schedule !== 'object') {
      throw new Error('Schedule must be an object');
    }

    const { time, timezone = 'UTC', frequency = 'once' } = schedule;

    if (!time) {
      throw new Error('Schedule time is required');
    }

    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      throw new Error('Invalid time format. Use HH:MM format');
    }

    if (!moment.tz.zone(timezone)) {
      throw new Error('Invalid timezone');
    }

    if (!['once', 'daily'].includes(frequency)) {
      throw new Error('Frequency must be "once" or "daily"');
    }

    return true;
  }
}

module.exports = SchedulerService;