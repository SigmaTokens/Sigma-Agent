import { Constants } from '../constants.ts';
import { Globals } from '../globals.ts';
import { initHoneytokens } from '../utilities/init.ts';

export function registerGeneralEventHandlers() {
  Globals.socket.on('connect', () => {
    const agentId = process.env[Constants.AGENT_ID_VARIABLE];
    console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] Connected to manager as', agentId);
  });

  Globals.socket.on('disconnect', () => {
    console.log(Constants.TEXT_RED_COLOR, '[WebSocket] Disconnected from manager');
  });

  Globals.socket.on('connect_error', (err) => {
    console.log(Constants.TEXT_RED_COLOR, '[WebSocket] Connection error:', err.message);
  });

  Globals.socket.on('command', ({ action, payload }) => {
    console.log(Constants.TEXT_GREEN_COLOR, `[WebSocket] Received command: ${action}`, payload);
  });

  Globals.socket.on('INIT_AGENT', (callback) => {
    console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] initiating agent!');
    initHoneytokens();
    callback({
      status: 'initiated',
    });
  });

  Globals.socket.on('CLOSE_AGENT', (callback) => {
    console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] closing agent!');
    callback({
      status: 'closed',
    });
    Globals.socket.close();
  });
}
