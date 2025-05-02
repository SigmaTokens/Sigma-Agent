import { Router } from 'express';
import { Globals } from '../globals.ts';

export function agentStatus() {
  const router = Router();

  router.get('/status', async (req, res) => {
    try {
      res.sendStatus(200);
    } catch (error: any) {
      console.error('[-] Failed to create alert:', error.message);
      res.status(500).json({ failure: error.message });
    }
  });

  Globals.app.use('', router);
}
