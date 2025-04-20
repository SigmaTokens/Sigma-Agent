import { Globals } from '../globals';
import { Router } from 'express';

export function serveMonitor() {
  const router = Router();
  router.post('/monitor/start', (req, res) => {});

  router.post('/monitor/stop', (req, res) => {});

  Globals.app.use('/api', router);
}
