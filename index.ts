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

main();

function main(): void {
  const app = express();
  app.use(express.json());
  app.use(cors());
  app.use(express.urlencoded({ extended: true }));

  if (!validate_environment_file()) return;

  Globals.port = parseInt(process.env.PORT ? process.env.PORT : Constants.DEFAULT_AGENT_PORT);

  send_initial_request_to_manager();
  initWebSocketConnection();

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
          console.log(Constants.TEXT_GREEN_COLOR,`[+] Server running on port ${Globals.port}`,Constants.TEXT_WHITE_COLOR);
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
    console.log(Constants.TEXT_GREEN_COLOR,`Running on Windows`,Constants.TEXT_WHITE_COLOR);
    await windows_enable_auditing();
  } else if (isLinux()) {
    console.log(Constants.TEXT_GREEN_COLOR,`Running on Linux`,Constants.TEXT_WHITE_COLOR);
  } else if (isMac()) {
    console.log(Constants.TEXT_GREEN_COLOR,`Running on Mac`,Constants.TEXT_WHITE_COLOR);
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
    console.error(Constants.TEXT_RED_COLOR, '[-] Error: environment file .env not found');
    return false;
  }
}

function send_initial_request_to_manager(): void {
  const ips = getLocalIPv4s();
  
  try {
    fetch(`http://${process.env.MANAGER_IP}:${process.env.MANAGER_PORT}/api/agents/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: process.env[Constants.AGENT_ID_VARIABLE],
        ip: ips[0],
        name: process.env.AGENT_NAME,
        port: Globals.port,
      }),
    }).then((res) => {
      console.log(Constants.TEXT_GREEN_COLOR,`[+] Sending initial request to manager was sucsseful`, Constants.TEXT_WHITE_COLOR);
    });
  } catch (err) {
    console.error(Constants.TEXT_RED_COLOR, '[-] Error sending initial request to manager:', err, Constants.TEXT_WHITE_COLOR);
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

  Globals.socket.on('connect', () => {
    console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] Connected to manager as', agentId, Constants.TEXT_WHITE_COLOR);
  });

  Globals.socket.on('disconnect', () => {
    console.log(Constants.TEXT_RED_COLOR, '[WebSocket] Disconnected from manager', Constants.TEXT_WHITE_COLOR);
  });

  Globals.socket.on('connect_error', (err) => {
    console.log(Constants.TEXT_RED_COLOR, '[WebSocket] Connection error:', err.message, Constants.TEXT_WHITE_COLOR);
  });

  Globals.socket.on('command', ({ action, payload }) => {
    console.log(Constants.TEXT_GREEN_COLOR, `[WebSocket] Received command: ${action}`, payload, Constants.TEXT_WHITE_COLOR);
  });

  setInterval(() => {
    Globals.socket?.emit('statusUpdate', {
      status: {
        platform: process.platform,
        time: new Date().toISOString(),
      },
    });
  }, 60_000);
}
