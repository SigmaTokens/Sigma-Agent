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
import { v4 as uuidv4 } from 'uuid';

main();

function main(): void {
  const app = express();
  app.use(express.json());
  app.use(cors());
  app.use(express.urlencoded({ extended: true }));

  if (!validate_environment_file()) return;

  Globals.port = parseInt(process.env.PORT ? process.env.PORT : Constants.DEFAULT_AGENT_PORT);

  send_initial_request_to_manager();

  isAdmin().then((isAdmin) => {
    if (!isAdmin) {
      console.error(Constants.TEXT_RED_COLOR, 'Please run as administrator');
      return;
    }
    // prettier-ignore
    init().then(() => {
        Globals.app = app;
        // initHoneytokens(); // TODO: this needs to be modified -run this function only when manager verified the agent
        serveGeneral();  
        serveHoneytoken();
        agentStatus();
        serveMonitor();

        Globals.app.listen(  Globals.port , () => {
          console.log(`[+] Server running on port ${  Globals.port }`);
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
    //TODO: add validations that all variables needed exists
    if (!process.env[Constants.AGENT_ID_VARIABLE]) {
      const new_uuid = uuidv4();
      fs.appendFileSync(env_path, `\n${Constants.AGENT_ID_VARIABLE}=${new_uuid}`, { encoding: 'utf-8' });
      process.env[Constants.AGENT_ID_VARIABLE] = new_uuid;
    }
    console.log(Constants.TEXT_YELLOW_COLOR, `Your uuid is: ${process.env[Constants.AGENT_ID_VARIABLE]}`);
    return true;
  } else {
    console.log(Constants.TEXT_RED_COLOR, 'Error: environment file .env not found');
    return false;
  }
}

function send_initial_request_to_manager(): void {
  import('ip').then((ipModule) => {
    const ip = (ipModule as any).default || ipModule;

    fetch(`http://${process.env.MANAGER_IP}:${process.env.MANAGER_PORT}/api/agents/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: process.env[Constants.AGENT_ID_VARIABLE],
        ip: ip.address(),
        name: process.env.AGENT_NAME,
        port: Globals.port,
      }),
    });
  });
}
