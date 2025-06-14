import { Constants } from '../constants.js';
import { Globals } from '../globals.ts';
import { initHoneytokens } from '../utilities/init.ts';

export function registerGeneralEventHandlers() {
  Globals.socket.on('connect', () => {
    const agentId = process.env[Constants.AGENT_ID_VARIABLE];
    console.log(
      Constants.TEXT_GREEN_COLOR,
      '[WebSocket] Connected to manager as',
      agentId,
      Constants.TEXT_DEFAULT_COLOR,
    );
  });

  Globals.socket.on('disconnect', () => {
    console.log(Constants.TEXT_RED_COLOR, '[WebSocket] Disconnected from manager', Constants.TEXT_DEFAULT_COLOR);
  });

  Globals.socket.on('connect_error', (err) => {
    console.log(Constants.TEXT_RED_COLOR, '[WebSocket] Connection error:', err.message, Constants.TEXT_DEFAULT_COLOR);
  });

  Globals.socket.on('command', ({ action, payload }) => {
    console.log(
      Constants.TEXT_GREEN_COLOR,
      `[WebSocket] Received command: ${action}`,
      payload,
      Constants.TEXT_DEFAULT_COLOR,
    );
  });

  Globals.socket.on('CLOSE_AGENT', (callback) => {
    console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] closing agent!', Constants.TEXT_DEFAULT_COLOR);
    callback({
      status: 'closed',
    });
    Globals.socket.close();
  });
}
