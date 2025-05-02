import { Router } from 'express';
import { Globals } from '../globals.ts';

export function serveGeneral() {
  const router = Router();

  Globals.app.use('/', router);
}
