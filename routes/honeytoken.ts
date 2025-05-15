import { Router } from 'express';

import * as fs from 'fs';
import * as path from 'path';
import { Honeytoken_Text } from '../classes/text/honeytoken_text.ts';
import { Globals } from '../globals.ts';
import { isFromManager } from '../utilities/auth.ts';

export function serveHoneytoken() {
  const router = Router();

  router.post('/honeytoken/add', async (req, res) => {
    try {
      const origin = req.get('origin') || '';
      if (!isFromManager(origin)) {
        res.status(500).json({ failure: 'not requested by the manager!' });
        return;
      }
      console.log({ received_data: req.body });
      const { token_id, group_id, type, file_name, location, grade, expiration_date, notes, data } = req.body;

      let received_token = null;

      if (type === 'text')
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
        Globals.tokens.push(received_token);

        const filePath = path.join(location, file_name);

        if (!fs.existsSync(filePath)) {
          received_token.createFile(data);
        }

        received_token.startMonitor();
        console.log('cool');
        res.status(200).json({ success: 'honeytoken has been deployed and monitored!' });
        return;
      }
      res.status(500).json({ failure: 'failed to add token' });
      return;
    } catch (error: any) {
      res.status(500).json({ failure: error.message });
      return;
    }
  });

  router.post('/honeytoken/remove', async (req, res) => {
    try {
      const origin = req.get('origin') || '';
      if (!isFromManager(origin)) {
        console.warn(`Unauthorized removal attempt from ${origin}`);
        res.status(403).json({ failure: 'Access denied' });
        return;
      }

      const { token_id } = req.body;
      if (!token_id) {
        res.status(400).json({ failure: 'token_id is required' });
        return;
      }

      // Find and remove the token from Globals.tokens
      const tokenIndex = Globals.tokens.findIndex((t) => t.getTokenID() === token_id);
      if (tokenIndex === -1) {
        res.status(404).json({ failure: 'Honeytoken not found' });
        return;
      }

      const tokenToRemove = Globals.tokens[tokenIndex] as Honeytoken_Text;

      try {
        // Stop monitoring first
        await tokenToRemove.stopMonitor();

        // Remove the physical file if it exists
        console.log('the honeytoken to remove type: ', tokenToRemove.getType());

        if (tokenToRemove.getType() === 'text') {
          const fullPath = path.join(tokenToRemove.getLocation(), tokenToRemove.getFileName());

          console.log(`[!] Deleting honeytoken file: ${fullPath}`);
          if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath);
            console.log(`[!] Deleted!`);
          }
        }

        // Remove from global tokens array
        Globals.tokens.splice(tokenIndex, 1);

        res.status(200).json({ success: 'Honeytoken removed successfully' });
        return;
      } catch (error) {
        console.error(`Error during token removal: ${error}`);
        res.status(500).json({ failure: 'Error during token removal' });
        return;
      }
    } catch (error) {
      console.error('Honeytoken removal error:', error);
      res.status(500).json({
        failure: error instanceof Error ? error.message : 'Internal server error',
      });
      return;
    }
  });

  router.post('/honeytoken/status', (req, res) => {
    try {
      const origin = req.get('origin') || '';
      if (!isFromManager(origin)) {
        res.status(403).json({ failure: 'Access denied' });
      }

      const { token_id } = req.body;

      let isMonitoring = false;

      for (const token of Globals.tokens) {
        if (token instanceof Honeytoken_Text && token.getTokenID() === token_id && token.isMonitoring()) {
          isMonitoring = true;
          break;
        }
      }

      res.status(isMonitoring ? 200 : 201).json({
        status: isMonitoring ? 'monitoring' : 'not monitoring',
      });
    } catch (error: any) {
      console.error('Status check error:', error);
      res.status(500).json({ failure: 'Internal server error' });
    }
  });

  router.post('/honeytoken/start', async (req, res) => {
    try {
      const origin = req.get('origin') || '';
      const { token_id } = req.body;

      if (!isFromManager(origin)) {
        console.warn(`Unauthorized monitoring attempt from ${origin}`);
        res.status(403).json({ failure: 'Access denied' });
        return;
      }

      if (!token_id) {
        res.status(400).json({ failure: 'token_id is required' });
        return;
      }

      const token = Globals.tokens.find((t) => t.getTokenID() === token_id);

      if (!token) {
        res.status(404).json({ failure: 'Honeytoken not found' });
        return;
      }

      if (!(token instanceof Honeytoken_Text)) {
        res.status(400).json({ failure: 'Invalid honeytoken type' });
        return;
      }

      if (token.isMonitoring()) {
        res.status(200).json({
          success: 'Monitoring already running for this token',
        });
        return;
      }

      token.startMonitor();
      res.status(200).json({
        success: 'Monitoring started successfully',
      });
      return;
    } catch (error) {
      console.error('Monitor startup error:', error);
      res.status(500).json({
        failure: error instanceof Error ? error.message : 'Internal server error',
      });
      return;
    }
  });

  router.post('/honeytoken/stop', async (req, res) => {
    try {
      const origin = req.get('origin') || '';
      const { token_id } = req.body;

      if (!isFromManager(origin)) {
        console.warn(`Unauthorized monitoring attempt from ${origin}`);
        res.status(403).json({ failure: 'Access denied' });
        return;
      }

      if (!token_id) {
        res.status(400).json({ failure: 'token_id is required' });
        return;
      }

      const token = Globals.tokens.find((t) => t.getTokenID() === token_id);

      if (!token) {
        console.log('Honeytoken not found');
        res.status(404).json({ failure: 'Honeytoken not found' });
        return;
      }

      if (!(token instanceof Honeytoken_Text)) {
        console.log('Invalid honeytoken type');
        res.status(400).json({ failure: 'Invalid honeytoken type' });
        return;
      }

      if (!token.isMonitoring()) {
        console.log('Monitoring not active for this token');
        res.status(200).json({
          success: 'Monitoring not active for this token',
        });
        return;
      }

      await token.stopMonitor();
      console.log('Monitoring stopped successfully');
      res.status(200).json({
        success: 'Monitoring stopped successfully',
      });
      return;
    } catch (error) {
      console.error('Stop monitoring error:', error);
      res.status(500).json({
        failure: error instanceof Error ? error.message : 'Internal server error',
      });
      return;
    }
  });

  Globals.app.use('/api', router);
}
