import { Globals } from '../globals.ts';
import { Router } from 'express';
import { isFromManager } from '../utilities/auth.ts';
import { Honeytoken_Text } from '../classes/text/honeytoken_text.ts';

export function serveMonitor() {
  const router = Router();

  router.get('/monitor/status', (req, res) => {
    try {
      const origin = req.get('origin') || '';
      if (!isFromManager(origin)) {
        res.status(403).json({ failure: 'Access denied' });
      }

      let isMonitoring = false;

      for (const token of Globals.tokens) {
        if (token instanceof Honeytoken_Text && token.isMonitoring()) {
          isMonitoring = true;
          break;
        }
      }

      res.status(isMonitoring ? 200 : 201).json({
        status: isMonitoring ? 'monitoring' : 'not monitoring',
      });
    } catch (error: any) {
      console.error('Status check error:', error);
      res.status(500).json({ failure: 'Internal server error' });
    }
  });

  router.get('/monitor/start', async (req, res) => {
    try {
      const origin = req.get('origin') || '';

      if (!isFromManager(origin)) {
        console.warn(`Unauthorized monitoring attempt from ${origin}`);
        res.status(403).json({ failure: 'Access denied' });
        return;
      }

      if (Globals.tokens.length === 0) {
        res.status(200).json({ success: 'No honeytokens to monitor' });
        return;
      }

      const results = await Promise.all(
        Globals.tokens.map(async (token) => {
          try {
            if (token instanceof Honeytoken_Text && !token.isMonitoring()) {
              token.startMonitor();
              return { success: true };
            }
            return { skipped: true };
          } catch (error) {
            console.error(`Failed to start monitoring for token:`, error);
            return { error: true };
          }
        }),
      );

      const anyStarted = results.some((r) => r.success);
      const anyFailed = results.some((r) => r.error);
      const allSkipped = results.every((r) => r.skipped);

      if (anyFailed) {
        res.status(207).json({
          success: anyStarted ? 'Partial success' : 'All tokens failed',
          failure: 'Some tokens failed to start',
          stats: {
            total: Globals.tokens.length,
            started: results.filter((r) => r.success).length,
            failed: results.filter((r) => r.error).length,
            skipped: results.filter((r) => r.skipped).length,
          },
        });
        return;
      }

      if (allSkipped) {
        res.status(200).json({
          success: 'Monitoring was already running for all tokens',
        });
        return;
      }

      res.status(200).json({
        success: 'Monitoring started for all applicable honeytokens',
        stats: {
          total: Globals.tokens.length,
          started: results.filter((r) => r.success).length,
          skipped: results.filter((r) => r.skipped).length,
        },
      });
      return;
    } catch (error) {
      console.error('Monitor startup error:', error);
      res.status(500).json({
        failure: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }
  });

  router.get('/monitor/stop', async (req, res) => {
    try {
      const origin = req.get('origin') || '';
      if (!isFromManager(origin)) {
        res.status(403).json({ failure: 'Access denied' });
      }

      let anyStopped = false;

      for (const token of Globals.tokens) {
        if (token instanceof Honeytoken_Text) {
          if (token.isMonitoring()) {
            token.stopMonitor();
            anyStopped = true;
          }
        }
      }

      res.status(200).json({
        success: anyStopped ? 'Monitoring stopped for all honeytokens' : 'No monitoring was active',
      });
    } catch (error: any) {
      console.error('Stop monitoring error:', error);
      res.status(500).json({ failure: 'Internal server error' });
    }
  });

  Globals.app.use('/api', router);
}
