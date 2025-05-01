import { Router } from 'express';
import { Globals } from '../globals.ts';

export function serveGeneral() {
  const router = Router();

  router.get('/status', (req, res) => {
    // TODO: check request from manager
    res.status(200).send();
  });

  Globals.app.use('/', router);
}
