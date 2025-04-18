import { Router, Express } from 'express';

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { Honeytoken_Text } from '../classes/honeytoken_type';
import { Globals } from '../globals';

export function serveAgent(app: Express) {
  const router = Router();

  router.post('agent/honeytoken/add', (req, res) => {
    try {
      console.log(req.body);
      const { type, file_name, location, grade, expiration_date, notes, data } =
        req.body;

      let newToken = null;

      if (type === 'text')
        newToken = new Honeytoken_Text(
          uuidv4(),
          uuidv4(),
          type,
          expiration_date,
          grade,
          notes,
          location,
          file_name,
        );

      if (newToken) {
        Globals.tokens.push(newToken);

        const filePath = path.join(location, file_name);

        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, data);
        }

        newToken.startAgent();

        res.send().status(200);
        return;
      }
      res.status(500).json({ failure: 'failed to add token' });
      return;
    } catch (error: any) {
      res.status(500).json({ failure: error.message });
      return;
    }
  });

  router.post('agent/honeytoken/remove', (req, res) => {
    try {
      console.log(req.body);
      const { token_id } = req.body;

      let token_to_remove = null;

      for (let i = 0; i < Globals.tokens.length; i++)
        if (Globals.tokens[i].getTokenID() === token_id)
          token_to_remove = Globals.tokens[i];

      if (token_to_remove && token_to_remove.getType() === 'text') {
        try {
          const token = token_to_remove as Honeytoken_Text;

          const fullPath = path.join(token.getLocation(), token.getFileName());

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

  app.use('/api', router);
}
