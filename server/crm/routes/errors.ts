/**
 * Error Logs Routes
 * API endpoints for viewing and managing error logs
 */

import { Router } from 'express';
import { errorTracker } from '../error-tracker';

export function createErrorsRouter() {
  const router = Router();

  /**
   * GET /errors/recent
   * Get recent errors
   */
  router.get('/recent', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const errors = await errorTracker.getRecentErrors(limit);

      res.json({ errors, total: errors.length });
    } catch (error) {
      console.error('[Errors] Error fetching recent errors:', error);
      res.status(500).json({
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /errors/rate
   * Get error rate for a time period
   */
  router.get('/rate', async (req, res) => {
    try {
      const { startTime, endTime } = req.query;

      const start = startTime
        ? parseInt(startTime as string)
        : Date.now() - 24 * 60 * 60 * 1000; // Default: last 24h

      const end = endTime ? parseInt(endTime as string) : Date.now();

      const errorRate = await errorTracker.getErrorRate(start, end);
      const errorCount = await errorTracker.getErrorCount(start, end);

      res.json({
        errorRate,
        errorCount,
        period: {
          start,
          end,
          duration: end - start,
        },
      });
    } catch (error) {
      console.error('[Errors] Error calculating error rate:', error);
      res.status(500).json({
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /errors/by-type
   * Get errors grouped by type
   */
  router.get('/by-type', async (req, res) => {
    try {
      const { startTime, endTime } = req.query;

      const start = startTime
        ? parseInt(startTime as string)
        : Date.now() - 24 * 60 * 60 * 1000; // Default: last 24h

      const end = endTime ? parseInt(endTime as string) : Date.now();

      const errorsByType = await errorTracker.getErrorsByType(start, end);

      res.json({
        errors: errorsByType,
        total: errorsByType.reduce((sum, e) => sum + e.count, 0),
        period: {
          start,
          end,
        },
      });
    } catch (error) {
      console.error('[Errors] Error fetching errors by type:', error);
      res.status(500).json({
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /errors/log
   * Manually log an error (for testing or manual logging)
   */
  router.post('/log', async (req, res) => {
    try {
      const { errorType, errorMessage, context, conversationId, advisorId, severity } = req.body;

      if (!errorType || !errorMessage) {
        res.status(400).json({
          error: 'invalid_request',
          message: 'errorType and errorMessage are required',
        });
        return;
      }

      await errorTracker.logError({
        timestamp: Date.now(),
        errorType,
        errorMessage,
        context,
        conversationId,
        advisorId,
        severity: severity || 'error',
      });

      res.json({ success: true, message: 'Error logged successfully' });
    } catch (error) {
      console.error('[Errors] Error logging error:', error);
      res.status(500).json({
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * DELETE /errors/cleanup
   * Clean up old errors (admin only)
   */
  router.delete('/cleanup', async (req, res) => {
    try {
      // Verify user is admin
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({
          error: 'forbidden',
          message: 'Only administrators can cleanup errors',
        });
        return;
      }

      const days = parseInt(req.query.days as string) || 30;

      const deleted = await errorTracker.clearOldErrors(days);

      res.json({
        success: true,
        deleted,
        message: `Cleaned up ${deleted} errors older than ${days} days`,
      });
    } catch (error) {
      console.error('[Errors] Error cleaning up errors:', error);
      res.status(500).json({
        error: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
