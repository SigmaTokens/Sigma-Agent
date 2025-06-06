import { exec } from 'child_process';
import { Constants } from '../constants.ts';

export function getPlatform(): NodeJS.Platform {
  return process.platform;
}

export function isLinux(): boolean {
  return process.platform === 'linux';
}

export function isWindows(): boolean {
  return process.platform === 'win32';
}

export function isMac(): boolean {
  return process.platform === 'darwin';
}

export async function windows_enable_auditing() {
  exec('auditpol.exe /set /subcategory:"File System" /success:enable', (error, stdout, stderr) => {
    if (error) {
      console.error(Constants.TEXT_RED_COLOR, `Error enabling audit policy: ${error}`, Constants.TEXT_WHITE_COLOR);
      process.exit(1);
    }
    console.log(Constants.TEXT_YELLOW_COLOR, 'Audit Object Access enabled:', stdout, Constants.TEXT_WHITE_COLOR);
  });
}
