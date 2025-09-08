import { io } from 'socket.io-client';

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { Globals } from './globals.ts';
import { isAdmin } from './utilities/auth.ts';
import { Constants } from './constants.js';
import { isWindows, windows_enable_auditing, isMac, isLinux } from './utilities/host.ts';
import { serveHoneytoken } from './routes/honeytoken.ts';
import { serveMonitor } from './routes/monitor.ts';
import { serveGeneral } from './routes/general.ts';
import { agentStatus } from './routes/status.ts';
import { initHoneytokens } from './utilities/init.ts';
import { v4 as uuidv4 } from 'uuid';
import { registerGeneralEventHandlers } from './sockets/general.ts';
import { registerHoneytokenEventHandlers } from './sockets/honeytoken.ts';
import { registerMonitorEventHandlers } from './sockets/monitor.ts';
import { registerStatusEventHandlers } from './sockets/status.ts';
import { isIP } from 'node:net';

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
      console.error(Constants.TEXT_RED_COLOR, 'Please run as administrator', Constants.TEXT_DEFAULT_COLOR);
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
          console.log(
            Constants.TEXT_MAGENTA_COLOR,
            `[+] Server running on port ${Globals.port}`,
            Constants.TEXT_DEFAULT_COLOR,
          );
        });
      })
      .catch((error) => {
        console.error(
          Constants.TEXT_RED_COLOR,
          '[-] Failed to initialize server:',
          error,
          Constants.TEXT_DEFAULT_COLOR,
        );
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
      fs.appendFileSync(env_path, `\n${Constants.AGENT_ID_VARIABLE}=${new_uuid}`, { encoding: 'utf-8' });
      process.env[Constants.AGENT_ID_VARIABLE] = new_uuid;
    }
    console.log(
      Constants.TEXT_YELLOW_COLOR,
      `Your uuid is: ${process.env[Constants.AGENT_ID_VARIABLE]}`,
      Constants.TEXT_DEFAULT_COLOR,
    );
    return true;
  } else {
    console.log(Constants.TEXT_RED_COLOR, 'Error: environment file .env not found', Constants.TEXT_DEFAULT_COLOR);
    return false;
  }
}

function initWebSocketConnection() {
  const agentId = process.env[Constants.AGENT_ID_VARIABLE];
  const raw = process.env.MANAGER_HOST!;

  const ioUrl = normalizeIoUrl(raw);

  Globals.socket = io(ioUrl, {
    query: { agentId },
    reconnection: true,
  });

  Globals.socket.on('connect', () =>
    console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] Connected to', ioUrl, Constants.TEXT_DEFAULT_COLOR),
  );
  Globals.socket.on('connect_error', (err) =>
    console.error(Constants.TEXT_RED_COLOR, '[WebSocket] Socket connect_error:', err, Constants.TEXT_DEFAULT_COLOR),
  );
  Globals.socket.on('error', (err) =>
    console.error(Constants.TEXT_RED_COLOR, '[WebSocket] Socket error:', err, Constants.TEXT_DEFAULT_COLOR),
  );

  registerGeneralEventHandlers();
  registerHoneytokenEventHandlers();
  registerMonitorEventHandlers();
  registerStatusEventHandlers();

  setInterval(() => {
    Globals.socket.emit('statusUpdate', {
      status: {
        platform: process.platform,
        time: new Date().toISOString(),
      },
    });
  }, 60_000);
}

function normalizeIoUrl(raw: string): string {
  if (!raw) throw new Error('MANAGER_HOST is empty');

  const trimmed = raw.trim().replace(/\/+$/, '');

  // If protocol is already present, just return (sans trailing slash).
  if (/^(?:https?|wss?):\/\//i.test(trimmed)) return trimmed;

  // Split into [host] and optional :port
  const m = trimmed.match(/^(\[[^\]]+\]|[^:]+)(?::(\d{1,5}))?$/);
  if (!m) throw new Error(`Invalid MANAGER_HOST: "${raw}"`);

  let host = m[1];
  const port = m[2];

  // Unwrap brackets for IP test
  const unwrapped = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;

  const ipVersion = isIP(unwrapped); // 0 = no, 4, 6
  const isLocalhost = unwrapped.toLowerCase() === 'localhost';

  // IPs (or localhost) → ws://, domains → https://
  const scheme = ipVersion > 0 || isLocalhost ? 'ws://' : 'https://';

  // Re-wrap IPv6 if needed
  if (ipVersion === 6 && !host.startsWith('[')) host = `[${unwrapped}]`;

  const authority = port ? `${host}:${port}` : host;
  return `${scheme}${authority}`;
}
