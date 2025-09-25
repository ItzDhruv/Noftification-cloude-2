const express = require('express');
const NotificationService = require('../services/NotificationService');
const SchedulerService = require('../services/SchedulerService');
const { 
  validateNotification, 
  validateBulkNotification,
  validateScheduledNotification 
} = require('../middleware/validation');
const logger = require('../utils/logger');

const router = express.Router();
const notificationService = new NotificationService();
const schedulerService = new SchedulerService();

// Start scheduler service
schedulerService.start();

// Send single notification (immediate or scheduled)
router.post('/send', validateNotification, async (req, res) => {
  try {
    const { notification, options = {}, schedule } = req.body;
    
    logger.info('Received notification request', { 
      hasSchedule: !!schedule,
      provider: options.provider,
      hasFailover: options.enableFailover 
    });

    // If schedule is provided, schedule the notification
    if (schedule) {
      const scheduleResult = schedulerService.scheduleNotification(
        notification, 
        schedule, 
        notificationService, 
        options
      );

      return res.status(200).json({
        success: true,
        message: 'Notification scheduled successfully',
        data: {
          scheduled: true,
          ...scheduleResult,
          notification: {
            title: notification.title,
            body: notification.body.substring(0, 100) + (notification.body.length > 100 ? '...' : '')
          }
        }
      });
    }

    // Send immediate notification
    const result = await notificationService.sendNotification(notification, options);
    
    res.status(200).json({
      success: true,
      message: 'Notification sent successfully',
      data: {
        scheduled: false,
        ...result,
        sentAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to send notification:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to process notification request',
      error: error.message
    });
  }
});

// Send bulk notifications
router.post('/send/bulk', validateBulkNotification, async (req, res) => {
  try {
    const { notifications, options = {}, schedule } = req.body;
    
    logger.info('Received bulk notification request', { 
      count: notifications.length,
      hasSchedule: !!schedule,
      provider: options.provider 
    });

    // If schedule is provided, schedule all notifications
    if (schedule) {
      const scheduleResults = [];
      
      for (let i = 0; i < notifications.length; i++) {
        try {
          const scheduleResult = schedulerService.scheduleNotification(
            notifications[i], 
            schedule, 
            notificationService, 
            options
          );
          
          scheduleResults.push({
            index: i,
            success: true,
            ...scheduleResult,
            notification: {
              title: notifications[i].title,
              body: notifications[i].body.substring(0, 50) + (notifications[i].body.length > 50 ? '...' : '')
            }
          });
        } catch (error) {
          scheduleResults.push({
            index: i,
            success: false,
            error: error.message,
            notification: {
              title: notifications[i].title,
              body: notifications[i].body.substring(0, 50) + (notifications[i].body.length > 50 ? '...' : '')
            }
          });
        }
      }

      const successCount = scheduleResults.filter(r => r.success).length;
      const failureCount = scheduleResults.length - successCount;

      return res.status(200).json({
        success: successCount > 0,
        message: `Bulk notifications scheduled: ${successCount} scheduled, ${failureCount} failed`,
        data: {
          scheduled: true,
          total: notifications.length,
          successful: successCount,
          failed: failureCount,
          results: scheduleResults
        }
      });
    }

    // Send immediate bulk notifications
    const results = await notificationService.sendBulkNotifications(notifications, options);
    
    res.status(200).json({
      success: results.successful > 0,
      message: `Bulk notification completed: ${results.successful} sent, ${results.failed} failed`,
      data: {
        scheduled: false,
        ...results,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to send bulk notifications:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to process bulk notification request',
      error: error.message
    });
  }
});

// Get available providers
router.get('/providers', (req, res) => {
  try {
    const providers = notificationService.getAvailableProviders();
    
    res.status(200).json({
      success: true,
      message: 'Providers retrieved successfully',
      data: {
        providers: providers,
        total: providers.length,
        enabled: providers.filter(p => p.enabled).length
      }
    });
  } catch (error) {
    logger.error('Failed to get providers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get providers',
      error: error.message
    });
  }
});

// Update provider status
router.patch('/providers/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Enabled field must be a boolean'
      });
    }
    
    const updated = notificationService.updateProviderStatus(name, enabled);
    
    if (updated) {
      res.status(200).json({
        success: true,
        message: `Provider ${name} ${enabled ? 'enabled' : 'disabled'} successfully`,
        data: {
          provider: name,
          enabled: enabled,
          updatedAt: new Date().toISOString()
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Provider ${name} not found`
      });
    }
  } catch (error) {
    logger.error('Failed to update provider status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update provider status',
      error: error.message
    });
  }
});

// Validate notification against all providers
router.post('/validate', (req, res) => {
  try {
    const { notification } = req.body;
    
    if (!notification) {
      return res.status(400).json({
        success: false,
        message: 'Notification object is required'
      });
    }

    const validation = notificationService.validateNotificationForProviders(notification);
    
    res.status(200).json({
      success: true,
      message: 'Notification validation completed',
      data: validation
    });
  } catch (error) {
    logger.error('Failed to validate notification:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to validate notification',
      error: error.message
    });
  }
});

// Scheduler management routes

// Get all scheduled jobs
router.get('/scheduled', (req, res) => {
  try {
    const jobs = schedulerService.getActiveJobs();
    
    res.status(200).json({
      success: true,
      message: 'Scheduled jobs retrieved successfully',
      data: {
        jobs: jobs,
        total: jobs.length,
        running: schedulerService.isRunning()
      }
    });
  } catch (error) {
    logger.error('Failed to get scheduled jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduled jobs',
      error: error.message
    });
  }
});

// Get specific scheduled job
router.get('/scheduled/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = schedulerService.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled job not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Scheduled job retrieved successfully',
      data: job
    });
  } catch (error) {
    logger.error('Failed to get scheduled job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduled job',
      error: error.message
    });
  }
});

// Cancel scheduled job
router.delete('/scheduled/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const removed = schedulerService.removeJob(jobId);
    
    if (removed) {
      res.status(200).json({
        success: true,
        message: 'Scheduled job cancelled successfully',
        data: {
          jobId: jobId,
          cancelledAt: new Date().toISOString()
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Scheduled job not found'
      });
    }
  } catch (error) {
    logger.error('Failed to cancel scheduled job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel scheduled job',
      error: error.message
    });
  }
});

module.exports = router;
