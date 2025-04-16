import { Router, Express } from 'express';

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { Honeytoken_Text } from '../classes/honeytoken_type';
import { Globals } from '../globals';

export function serveAgent(app: Express) {
  const router = Router();

  //temp-desc: request's body should have honeytoken's: metadata, type, location
  router.post('agent/honeytoken/add', (req, res) => {
    const { metadata, file_name, location, grade, expiration_date } = req.body;
  });

  //temp-desc: request's body should have honeytoken's: metadata, type, location
  router.post('agent/honeytoken/remove', (req, res) => {
    const { metadata, file_name, location } = req.body;
  });

  app.use('/api', router);
}

//desc: dummy adding text honeytoken poc endpoint
// router.post('agent/honeytoken/text', (req, res) => {
//   try {
//     /*
//         TODO:
//         1. check if file name is initial - create a name from a list
//         2. check if content is initial - create content from a list - optional ?
//         3. check if location is initial or does not exist - send error
//         4. create Honeytoken to array in globals.ts
//         5. write the honeytoken to the database
// 		6. create mapping for HoneytokenType
//       */
//     console.log(req.body);
//     const { file_name, location, grade, expiration_date, data, notes } =
//       req.body;

//     const newToken = new Honeytoken_Text(
//       uuidv4(),
//       uuidv4(),
//       'text',
//       expiration_date,
//       grade,
//       location,
//       file_name,
//       notes,
//     );

//     Globals.tokens.push(newToken);

//     //TODO: check if file exists - if not - create it using createFile in Honeytoken_Text.ts

//     const filePath = path.join(location, file_name);

//     if (!fs.existsSync(filePath)) {
//       fs.writeFileSync(filePath, data);
//     }

//     newToken.startAgent();

//     res.send().status(200);
//   } catch (error: any) {
//     res.status(500).json({ failure: error.message });
//   }
// });
