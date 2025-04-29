import express from 'express';
import cors from 'cors';
import { Globals } from './globals';
import { isAdmin } from './utilities/auth';
import { Constants } from './constants';
import {
  isWindows,
  windows_enable_auditing,
  isMac,
  isLinux,
} from './utilities/host';
import { serveHoneytoken } from './routes/honeytoken';
import { serveMonitor } from './routes/monitor';
import { serveGeneral } from './routes/general';
import { agentStatus } from './routes/status';

main();

function main(): void {
  const app = express();
  app.use(express.json());
  app.use(cors());
  app.use(express.urlencoded({ extended: true }));
  require('dotenv').config();
  const port = process.env.PORT || 9007;

  isAdmin().then((isAdmin) => {
    if (!isAdmin) {
      console.error(Constants.TEXT_RED_COLOR, 'Please run as administrator');
      return;
    }
    init()
      .then(() => {
        Globals.app = app;
        serveGeneral();
        serveHoneytoken();
        agentStatus();
        serveMonitor();

        Globals.app.listen(port, () => {
          console.log(`[+] Server running on port ${port}`);
        });
      })
      .catch((error) => {
        console.error('[-] Failed to initialize server:', error);
        process.exit(1);
      });
  });
}

async function init() {
  if (isWindows()) {
    await windows_enable_auditing();
  } else if (isLinux()) {
    console.log('Running on Linux');
  } else if (isMac()) {
    console.log('Running on Mac');
  }
}
