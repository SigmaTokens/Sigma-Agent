import { Globals } from '../globals';
import { Router } from 'express';
import { isFromManager } from '../utilities/auth';
import { Honeytoken_Text } from '../classes/honeytoken_text';

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

  router.get('/monitor/start', (req, res) => {
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

      let anyStarted = false;
      let anyFailed = false;

      Globals.tokens.forEach((token) => {
        try {
          if (token instanceof Honeytoken_Text && !token.isMonitoring()) {
            token.startMonitor();
            anyStarted = true;
          }
        } catch (tokenError) {
          console.error(`Failed to start monitoring for token:`, tokenError);
          anyFailed = true;
        }
      });

      // Response handling
      if (anyFailed) {
        res.status(207).json({
          success: anyStarted ? 'Partial success' : 'All tokens failed',
          failure: 'Some tokens failed to start',
        });
        return;
      }

      res.status(200).json({
        success: anyStarted
          ? 'Monitoring started for all honeytokens'
          : 'Monitoring was already running',
      });
      return;
    } catch (error) {
      console.error('Monitor startup error:', error);
      res.status(500).json({
        failure: 'Internal server error',
      });
      return;
    }
  });

  router.get('/monitor/stop', (req, res) => {
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
        success: anyStopped
          ? 'Monitoring stopped for all honeytokens'
          : 'No monitoring was active',
      });
    } catch (error: any) {
      console.error('Stop monitoring error:', error);
      res.status(500).json({ failure: 'Internal server error' });
    }
  });

  Globals.app.use('/api', router);
}
