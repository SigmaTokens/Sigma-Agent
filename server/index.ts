import express from 'express';
import cors from 'cors';
import { Globals } from './globals';
import { isAdmin } from './utilities/auth';
import { Constants } from './constants';
import { isWindows, windows_enable_auditing, isMac } from './utilities/host';
import { serveHoneytokens } from './routes/honeytokens';

main();

function main(): void {
  const app = express();
  app.use(express.json());

  app.use(cors());
  app.use(express.urlencoded({ extended: true }));
  const port = process.env.PORT || 9007;

  isAdmin().then((isAdmin) => {
    if (!isAdmin) {
      console.error(Constants.TEXT_RED_COLOR, 'Please run as administrator');
      return;
    }
    init()
      .then(() => {
        serveHoneytokens(app);
        Globals.app = app;

        app.listen(port, () => {
          console.log(`[+] Server running on port ${port}`);
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
    await windows_enable_auditing();
  } else if (isMac()) {
    console.log('Running on Mac');
  }
}

import { Honeytoken_Text } from './classes/Honeytoken_Text';

function test_honeytoken(): void {
  let location = 'C:\\Users\\Ovadya-PC\\Desktop';
  let file_name = 'test.txt';
  if (isMac()) {
    location = '/Users/sh/Desktop/';
    file_name = 'a.txt';
  }
  let ht_t = new Honeytoken_Text(
    '1',
    '1',
    'text',
    new Date(),
    5,
    'help',
    location,
    file_name,
  );
  ht_t.startAgent();
}
