import { io } from 'socket.io-client';

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
import { getLocalIPv4s, initHoneytokens } from './utilities/init.ts';
import { v4 as uuidv4 } from 'uuid';
import { registerGeneralEventHandlers } from './sockets/general.ts';
import { registerHoneytokenEventHandlers } from './sockets/honeytoken.ts';
import { registerMonitorEventHandlers } from './sockets/monitor.ts';
import { registerStatusEventHandlers } from './sockets/status.ts';

main();

function main(): void {
  const app = express();
  app.use(express.json());
  app.use(cors());
  app.use(express.urlencoded({ extended: true }));

  if (!validate_environment_file()) return;

  Globals.port = parseInt(process.env.PORT ? process.env.PORT : Constants.DEFAULT_AGENT_PORT);

  initWebSocketConnection();

  Globals.socket.emit('REGISTER_AGENT', {
    agent_id: process.env[Constants.AGENT_ID_VARIABLE],
    agent_name: process.env.AGENT_NAME,
    user_id: process.env.USER_ID,
  });

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

        Globals.app.listen(Globals.port, () => {
          console.log(`[+] Server running on port ${Globals.port}`);
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
  } else if (isMac()) {
  }
}

function validate_environment_file(): boolean {
  const env_path = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(env_path)) {
    dotenv.config();
    if (!process.env[Constants.AGENT_ID_VARIABLE]) {
      const new_uuid = uuidv4();
      fs.appendFileSync(env_path, `${Constants.AGENT_ID_VARIABLE}=${new_uuid}`, { encoding: 'utf-8' });
      process.env[Constants.AGENT_ID_VARIABLE] = new_uuid;
    }
    console.log(Constants.TEXT_YELLOW_COLOR, `Your uuid is: ${process.env[Constants.AGENT_ID_VARIABLE]}`);
    return true;
  } else {
    console.log(Constants.TEXT_RED_COLOR, 'Error: environment file .env not found');
    return false;
  }
}

function initWebSocketConnection() {
  const agentId = process.env[Constants.AGENT_ID_VARIABLE];
  const managerHost = process.env.MANAGER_IP;
  const managerPort = process.env.MANAGER_PORT;
  const wsUrl = `ws://${managerHost}:${managerPort}`;

  Globals.socket = io(wsUrl, {
    query: { agentId },
    transports: ['websocket'],
    reconnection: true,
  });

  registerGeneralEventHandlers();
  registerHoneytokenEventHandlers();
  registerMonitorEventHandlers();
  registerStatusEventHandlers();

  setInterval(() => {
    //sending
    Globals.socket.emit('statusUpdate', {
      status: {
        platform: process.platform,
        time: new Date().toISOString(),
      },
    });
    //
  }, 60_000);
}
