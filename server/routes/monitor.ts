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
        res.status(500).json({ failure: 'not requested by the manager!' });
        return;
      }

      for (let i = 0; i < Globals.tokens.length; i++) {
        const token = Globals.tokens[i] as Honeytoken_Text;
        if (token.isMonitoring())
          res.status(200).json({
            success: 'agent is monitoring!',
          });
        return;
      }

      res.status(201).json({ failure: 'agent is not monitoring!' });
      return;
    } catch (error: any) {
      res.status(500).json({ failure: error.message });
      return;
    }
  });

  router.get('/monitor/start', (req, res) => {
    try {
      const origin = req.get('origin') || '';
      if (!isFromManager(origin)) {
        res.status(500).json({ failure: 'not requested by the manager!' });
        return;
      }

      for (let i = 0; i < Globals.tokens.length; i++) {
        const token = Globals.tokens[i] as Honeytoken_Text;
        if (!token.isMonitoring()) token.startMonitor();
      }

      res
        .status(200)
        .json({ success: 'agent is running and monitoring all honeytokens!' });
      return;
    } catch (error: any) {
      res.status(500).json({ failure: error.message });
      return;
    }
  });

  router.get('/monitor/stop', (req, res) => {
    try {
      const origin = req.get('origin') || '';
      if (!isFromManager(origin)) {
        res.status(500).json({ failure: 'not requested by the manager!' });
        return;
      }

      console.log('test_1');
      for (let i = 0; i < Globals.tokens.length; i++) {
        const token = Globals.tokens[i] as Honeytoken_Text;
        if (token.isMonitoring()) token.stopMonitor();
      }
      console.log('yummmm');

      res.status(200).json({
        success: 'agent stopped monitorting all honeytokens!',
      });
      return;
    } catch (error: any) {
      res.status(500).json({ failure: error.message });
      return;
    }
  });

  Globals.app.use('/api', router);
}
