import express from 'express';
import cors from 'cors';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { Globals } from './globals.ts';
import { isAdmin } from './utilities/auth.ts';
import { Constants } from './constants.ts';
import { isWindows, windows_enable_auditing, isMac, isLinux } from './utilities/host.ts';
import { serveHoneytoken } from './routes/honeytoken.ts';
import { serveMonitor } from './routes/monitor.ts';
import { serveGeneral } from './routes/general.ts';
import { agentStatus } from './routes/status.ts';
import { initHoneytokens } from './utilities/init.ts';

main();

function main(): void {
  const app = express();
  app.use(express.json());
  app.use(cors());
  app.use(express.urlencoded({ extended: true }));

  //!!!!!!! TODO: add validation that .env file with the necessary stuff exists !!!!!!!!
  if (!validate_environment_file()) return;

  const port = process.env.PORT || 9007;

  isAdmin().then((isAdmin) => {
    if (!isAdmin) {
      console.error(Constants.TEXT_RED_COLOR, 'Please run as administrator');
      return;
    }
    init()
      .then(() => {
        Globals.app = app;
        initHoneytokens();
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

function validate_environment_file(): boolean {
  const env_path = path.resolve(process.cwd(), '.env');

  if (fs.existsSync(env_path)) {
    dotenv.config();
    return true;
  } else {
    console.log(Constants.TEXT_RED_COLOR, 'Error: environment file .env not found');
    return false;
  }
}
