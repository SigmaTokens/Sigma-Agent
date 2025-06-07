import { Constants } from '../constants.ts';
import { Globals } from '../globals.ts';
import { Honeytoken_Text } from '../classes/text/honeytoken_text.ts';
import { Honeytoken_API } from '../classes/api/honeytoken_api.ts';

export function registerMonitorEventHandlers() {
  Globals.socket.on('STATUS_AGENT', (callback) => {
    if (Globals.text_honeytokens.length === 0 && Globals.api_honeytokens.length === 0) {
      return callback({
        status: 'not monitoring',
      });
    }

    let isMonitoring = false;

    for (const token of Globals.text_honeytokens) {
      if (token instanceof Honeytoken_Text && token.isMonitoring()) {
        isMonitoring = true;
        break;
      }
    }

    for (const token of Globals.api_honeytokens) {
      if (token instanceof Honeytoken_API && token.isMonitoring()) {
        isMonitoring = true;
        break;
      }
    }

    if (isMonitoring)
      return callback({
        status: 'monitoring',
      });

    return callback({
      status: 'not monitoring',
    });
  });

  Globals.socket.on('STOP_AGENT', (callback) => {
    console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] stopping agent!');
    if (Globals.text_honeytokens.length === 0 && Globals.api_honeytokens.length === 0) {
      console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] No honeytokens to stop');
      return callback({
        status: 'stopped',
      });
    }

    let anyStopped = false;
    let allSkipped = true;

    for (const token of Globals.text_honeytokens) {
      if (token instanceof Honeytoken_Text) {
        if (token.isMonitoring()) {
          token.stopMonitor();
          anyStopped = true;
          allSkipped = false;
        }
      }
    }

    for (const token of Globals.api_honeytokens) {
      if (token instanceof Honeytoken_API) {
        if (token.isMonitoring()) {
          token.stopMonitor();
          anyStopped = true;
          allSkipped = false;
        }
      }
    }

    if (anyStopped || allSkipped)
      return callback({
        status: 'stopped',
      });

    return callback({
      status: 'failed',
    });
  });

  Globals.socket.on('START_AGENT', (callback) => {
    console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] starting agent!');
    if (Globals.text_honeytokens.length === 0 && Globals.api_honeytokens.length === 0) {
      console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] No honeytokens to monitor');
      return callback({
        status: 'started',
      });
    }

    let anyStarted = false;
    let allSkipped = true;

    for (const token of Globals.text_honeytokens) {
      if (token instanceof Honeytoken_Text) {
        if (!token.isMonitoring()) {
          token.startMonitor();
          anyStarted = true;
          allSkipped = false;
        }
      }
    }

    for (const token of Globals.api_honeytokens) {
      if (token instanceof Honeytoken_API) {
        if (!token.isMonitoring()) {
          token.startMonitor();
          anyStarted = true;
          allSkipped = false;
        }
      }
    }

    if (anyStarted || allSkipped)
      return callback({
        status: 'started',
      });

    return callback({
      status: 'failed',
    });
  });
}
