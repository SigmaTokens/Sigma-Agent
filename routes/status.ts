import { Router } from 'express';
import { Globals } from '../globals.ts';
import { Constants } from '../constants.js';

export function agentStatus() {
  const router = Router();

  router.get('/status', async (req, res) => {
    try {
      res.sendStatus(200);
    } catch (error: any) {
      console.error(
        Constants.TEXT_RED_COLOR,
        '[-] Failed to create alert:',
        error.message,
        Constants.TEXT_DEFAULT_COLOR,
      );
      res.status(500).json({ failure: error.message });
    }
  });

  Globals.app.use('', router);
}
