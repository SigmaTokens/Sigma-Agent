import { Constants } from '../constants.ts';
import { Globals } from '../globals.ts';
import { Honeytoken_Text } from '../classes/text/honeytoken_text.ts';
import { Honeytoken_API } from '../classes/api/honeytoken_api.ts';
import { HoneytokenType } from '../utilities/typing.ts';
import * as path from 'path';
import * as fs from 'fs';

export function registerHoneytokenEventHandlers() {
  Globals.socket.on('CREATE_HONEYTOKEN_TEXT', async (payload, callback) => {
    console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] creating honeytoken text!');
    const { token_id, group_id, type, file_name, location, grade, expiration_date, notes, data } = payload;

    let received_token = null;

    if (type === HoneytokenType.Text)
      received_token = await Honeytoken_Text.create(
        token_id,
        group_id,
        type,
        expiration_date,
        grade,
        notes,
        location,
        file_name,
      );

    if (received_token) {
      Globals.text_honeytokens.push(received_token);

      const filePath = path.join(location, file_name);

      if (!fs.existsSync(filePath)) {
        received_token.createFile(data);
      }

      received_token.startMonitor();

      return callback({
        status: 'created',
      });
    }

    return callback({
      status: 'failed',
    });
  });

  Globals.socket.on('DELETE_HONEYTOKEN_TEXT', async (payload, callback) => {
    console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] deleting honeytoken text!');

    if (!payload) {
      return callback({
        status: 'failed',
      });
    }

    const token_id = payload;
    if (!token_id) {
      return callback({
        status: 'failed',
      });
    }

    const tokenIndex = Globals.text_honeytokens.findIndex((t) => t.getTokenID() === token_id);
    if (tokenIndex === -1) {
      return callback({
        status: 'failed',
      });
    }

    const tokenToRemove = Globals.text_honeytokens[tokenIndex] as Honeytoken_Text;
    tokenToRemove.stopMonitor();

    console.log('the honeytoken to remove type: ', tokenToRemove.getType());

    if (tokenToRemove.getType() === HoneytokenType.Text) {
      const fullPath = path.join(tokenToRemove.getLocation(), tokenToRemove.getFileName());

      console.log(`[!] Deleting honeytoken file: ${fullPath}`);
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath);
        console.log(`[!] Deleted!`);
      }
    }

    Globals.text_honeytokens.splice(tokenIndex, 1);

    return callback({
      status: 'deleted',
    });
  });

  Globals.socket.on('STATUSES_HONEYTOKENS_TEXT', async (callback) => {
    console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] statuses of honeytokens text!');
    const statuses: Record<string, boolean> = {};

    for (const token of Globals.text_honeytokens) {
      if (token instanceof Honeytoken_Text) {
        // Use token_id as the key and isMonitoring() result as value
        statuses[token.token_id] = token.isMonitoring();
      }
    }

    return callback({
      success: true,
      message: statuses,
    });
  });

  Globals.socket.on('STATUSES_HONEYTOKENS_API', async (callback) => {
    console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] statuses of honeytokens api!');
    const statuses: Record<string, boolean> = {};

    for (const token of Globals.api_honeytokens) {
      statuses[token.group_id] = token.isMonitoring();
    }

    return callback({
      success: true,
      message: statuses,
    });
  });

  Globals.socket.on('STATUS_HONEYTOKEN_TEXT', async (payload, callback) => {
    console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] status of honeytoken text!');

    if (!payload) {
      return callback({
        status: 'failed',
      });
    }

    const token_id = payload;

    let isMonitoring = false;

    for (const token of Globals.text_honeytokens) {
      if (token instanceof Honeytoken_Text && token.getTokenID() === token_id && token.isMonitoring()) {
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

  Globals.socket.on('START_HONEYTOKEN_TEXT', async (payload, callback) => {
    console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] starting honeytoken text!');

    if (!payload) {
      return callback({
        status: 'failed',
      });
    }

    const token_id = payload;

    if (!token_id)
      return callback({
        status: 'failed',
      });

    const token = Globals.text_honeytokens.find((t) => t.getTokenID() === token_id) as Honeytoken_Text;

    if (!token)
      return callback({
        status: 'failed',
      });

    if (token.isMonitoring()) {
      return callback({
        status: 'monitoring',
      });
    }

    token.startMonitor();
    return callback({
      status: 'monitoring',
    });
  });

  Globals.socket.on('STOP_HONEYTOKEN_TEXT', async (payload, callback) => {
    console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] stopping honeytoken text!');

    if (!payload) {
      return callback({
        status: 'failed',
      });
    }

    const token_id = payload;

    if (!token_id)
      return callback({
        status: 'failed',
      });

    const token = Globals.text_honeytokens.find((t) => t.getTokenID() === token_id);

    if (!token)
      return callback({
        status: 'failed',
      });

    if (!(token instanceof Honeytoken_Text))
      return callback({
        status: 'failed',
      });

    if (!token.isMonitoring())
      return callback({
        status: 'not monitoring',
      });

    token.stopMonitor();
    return callback({
      status: 'not monitoring',
    });
  });

  Globals.socket.on('CREATE_HONEYTOKEN_API', async (payload, callback) => {
    console.log(Constants.TEXT_GREEN_COLOR, '[WebSocket] creating honeytoken api!');

    const { group_id, type, grade, expiration_date, api_port, apis } = payload;

    if (type === HoneytokenType.API) {
      const api_honeytoken: Honeytoken_API = await Honeytoken_API.create(
        group_id,
        expiration_date,
        grade,
        api_port,
        apis,
      );

      if (api_honeytoken) {
        Globals.api_honeytokens.push(api_honeytoken);
        return callback({
          status: 'created',
        });
      }
    }
    return callback({
      status: 'failed',
    });
  });

  Globals.socket.on('START_HONEYTOKEN_API', (payload) => {
    const group_id = payload;
    const api_token = Globals.api_honeytokens.find((token) => token.getGroupID() === group_id);
    api_token?.startMonitor();
  });

  Globals.socket.on('STOP_HONEYTOKEN_API', (payload) => {
    const group_id = payload;
    const api_token = Globals.api_honeytokens.find((token) => token.getGroupID() === group_id);
    api_token?.stopMonitor();
  });
}
