import { Router } from 'express';
import { Globals } from '../globals.ts';
import { initHoneytokens } from '../utilities/init.ts';

export function serveGeneral() {
  const router = Router();

  router.get('/general/init', async (req, res) => {
    try {
      await initHoneytokens();
      res.json({ success: true });
      return;
    } catch {
      res.json({ success: false });
      return;
    }
  });

  Globals.app.use('/', router);
}
