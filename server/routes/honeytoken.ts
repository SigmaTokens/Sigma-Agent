import { Router } from 'express';

import * as fs from 'fs';
import * as path from 'path';
import { Honeytoken_Text } from '../classes/honeytoken_text';
import { Globals } from '../globals';
import { isFromManager } from '../utilities/auth';

export function serveHoneytoken() {
  const router = Router();

  router.post('/honeytoken/add', (req, res) => {
    try {
      const origin = req.get('origin') || '';
      if (!isFromManager(origin)) {
        res.status(500).json({ failure: 'not requested by the manager!' });
        return;
      }
      console.log({ received_data: req.body });
      const {
        token_id,
        group_id,
        type,
        file_name,
        location,
        grade,
        expiration_date,
        notes,
        data,
      } = req.body;

      let received_token = null;

      if (type === 'text')
        received_token = new Honeytoken_Text(
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
        Globals.tokens.push(received_token);

        const filePath = path.join(location, file_name);

        if (!fs.existsSync(filePath)) {
          received_token.createFile(data);
        }

        received_token.startMonitor();

        res
          .status(200)
          .json({ success: 'honeytoken has been deployed and monitored!' });
        return;
      }
      res.status(500).json({ failure: 'failed to add token' });
      return;
    } catch (error: any) {
      res.status(500).json({ failure: error.message });
      return;
    }
  });

  router.post('/honeytoken/remove', (req, res) => {
    try {
      const origin = req.get('origin') || '';
      if (!isFromManager(origin)) {
        res.status(500).json({ failure: 'not requested by the manager!' });
        return;
      }

      console.log(req.body);
      const { token_id } = req.body;

      let token_to_remove = null;

      for (let i = 0; i < Globals.tokens.length; i++)
        if (Globals.tokens[i].getTokenID() === token_id)
          token_to_remove = Globals.tokens[i];

      if (token_to_remove) {
        token_to_remove = token_to_remove as Honeytoken_Text;
        token_to_remove.stopMonitor();
      }

      if (token_to_remove && token_to_remove.getType() === 'text') {
        try {
          const fullPath = path.join(
            token_to_remove.getLocation(),
            token_to_remove.getFileName(),
          );

          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log(`Deleted honeytoken file: ${fullPath}`);
          }
        } catch (error) {
          console.error(`Error during token deletion: ${error}`);
        }

        res.send().status(200);
        return;
      }

      res.status(500).json({ failure: 'failed to remove token' });
      return;
    } catch (error: any) {
      res.status(500).json({ failure: error.message });
      return;
    }
  });

  router.post('/honeytoken/start', (req, res) => {
    try {
      const origin = req.get('origin') || '';
      const { token_id } = req.body;
      let responseSent = false;

      if (!isFromManager(origin)) {
        console.warn(`Unauthorized monitoring attempt from ${origin}`);
        res.status(403).json({ failure: 'Access denied' });
        return;
      }

      if (!token_id) {
        res.status(400).json({ failure: 'token_id is required' });
        return;
      }

      Globals.tokens.forEach((token) => {
        if (token.getTokenID() === token_id) {
          if (!(token instanceof Honeytoken_Text)) {
            if (!responseSent) {
              res.status(400).json({ failure: 'Invalid honeytoken type' });
              responseSent = true;
            }
            return;
          }

          if (token.isMonitoring()) {
            if (!responseSent) {
              res
                .status(200)
                .json({ success: 'Monitoring already running for this token' });
              responseSent = true;
            }
            return;
          }

          token.startMonitor();
          if (!responseSent) {
            res
              .status(200)
              .json({ success: 'Monitoring started successfully' });
            responseSent = true;
          }
        }
      });

      if (!responseSent) {
        res.status(404).json({ failure: 'Honeytoken not found' });
      }
    } catch (error) {
      console.error('Monitor startup error:', error);
      if (!res.headersSent) {
        res.status(500).json({ failure: 'Internal server error' });
      }
    }
  });

  router.post('/honeytoken/stop', (req, res) => {
    try {
      const origin = req.get('origin') || '';
      const { token_id } = req.body;
      let responseSent = false;

      if (!isFromManager(origin)) {
        console.warn(`Unauthorized monitoring attempt from ${origin}`);
        res.status(403).json({ failure: 'Access denied' });
        return;
      }

      if (!token_id) {
        res.status(400).json({ failure: 'token_id is required' });
        return;
      }

      Globals.tokens.forEach((token) => {
        if (token.getTokenID() === token_id) {
          if (!(token instanceof Honeytoken_Text)) {
            if (!responseSent) {
              res.status(400).json({ failure: 'Invalid honeytoken type' });
              responseSent = true;
            }
            return;
          }

          if (!token.isMonitoring()) {
            if (!responseSent) {
              res
                .status(200)
                .json({ success: 'Monitoring not active for this token' });
              responseSent = true;
            }
            return;
          }

          token.stopMonitor();
          if (!responseSent) {
            res
              .status(200)
              .json({ success: 'Monitoring stopped successfully' });
            responseSent = true;
          }
        }
      });

      if (!responseSent) {
        res.status(404).json({ failure: 'Honeytoken not found' });
      }
    } catch (error) {
      console.error('Stop monitoring error:', error);
      if (!res.headersSent) {
        res.status(500).json({ failure: 'Internal server error' });
      }
    }
  });

  Globals.app.use('/api', router);
}
