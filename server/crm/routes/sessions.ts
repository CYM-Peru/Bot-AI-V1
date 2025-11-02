import { Router } from 'express';
import { sessionsStorage } from '../sessions';

export function createSessionsRouter() {
  const router = Router();

  /**
   * POST /api/crm/sessions
   * Start a new session
   */
  router.post('/', async (req, res) => {
    try {
      const { conversationId } = req.body;
      const advisorId = req.user?.userId;

      if (!conversationId || !advisorId) {
        res.status(400).json({ error: 'missing_data', message: 'conversationId and advisorId required' });
        return;
      }

      // Check if there's already an active session for this conversation
      const activeSession = await sessionsStorage.getActiveSession(conversationId);
      if (activeSession) {
        res.status(400).json({
          error: 'session_exists',
          message: 'Ya existe una sesión activa para esta conversación',
          session: activeSession
        });
        return;
      }

      const session = await sessionsStorage.startSession(advisorId, conversationId);
      res.json({ success: true, session });
    } catch (error) {
      console.error('[Sessions] Error starting session:', error);
      res.status(500).json({ error: 'server_error', message: 'Error al iniciar sesión' });
    }
  });

  /**
   * PUT /api/crm/sessions/:id/end
   * End a session
   */
  router.put('/:id/end', async (req, res) => {
    try {
      const { id } = req.params;

      const session = await sessionsStorage.endSession(id);

      if (!session) {
        res.status(404).json({ error: 'not_found', message: 'Sesión no encontrada' });
        return;
      }

      res.json({ success: true, session });
    } catch (error) {
      console.error('[Sessions] Error ending session:', error);
      res.status(500).json({ error: 'server_error', message: 'Error al finalizar sesión' });
    }
  });

  /**
   * GET /api/crm/sessions/active/:conversationId
   * Get active session for a conversation
   */
  router.get('/active/:conversationId', async (req, res) => {
    try {
      const { conversationId } = req.params;

      const session = await sessionsStorage.getActiveSession(conversationId);

      if (!session) {
        res.json({ session: null });
        return;
      }

      res.json({ session });
    } catch (error) {
      console.error('[Sessions] Error getting active session:', error);
      res.status(500).json({ error: 'server_error' });
    }
  });

  /**
   * GET /api/crm/sessions/stats
   * Get session statistics for current advisor
   */
  router.get('/stats', async (req, res) => {
    try {
      const advisorId = req.user?.userId;
      const period = (req.query.period as 'day' | 'week' | 'month') || 'day';

      if (!advisorId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }

      const stats = await sessionsStorage.getAdvisorStats(advisorId, period);

      res.json({ stats });
    } catch (error) {
      console.error('[Sessions] Error getting stats:', error);
      res.status(500).json({ error: 'server_error' });
    }
  });

  /**
   * GET /api/crm/sessions/stats/all
   * Get session statistics for all advisors (admin only)
   */
  router.get('/stats/all', async (req, res) => {
    try {
      const period = (req.query.period as 'day' | 'week' | 'month') || 'day';

      const stats = await sessionsStorage.getAllAdvisorsStats(period);

      res.json({ stats });
    } catch (error) {
      console.error('[Sessions] Error getting all stats:', error);
      res.status(500).json({ error: 'server_error' });
    }
  });

  return router;
}
