import { exec } from 'child_process';
import { Constants } from '../constants';

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
  exec(
    'auditpol.exe /set /subcategory:"File System" /success:enable',
    (error, stdout, stderr) => {
      if (error) {
        console.error(
          Constants.TEXT_RED_COLOR,
          `Error enabling audit policy: ${error}`,
        );
        process.exit(1);
      }
      console.log(
        Constants.TEXT_GREEN_COLOR,
        'Audit Object Access enabled:',
        stdout,
      );
    },
  );
}

export async function windows_enable_ping() {
  const psCommand =
    `
    Import-Module NetSecurity;
    if (-not (Get-NetFirewallRule -DisplayName "Allow ICMP" -ErrorAction SilentlyContinue)) {
      New-NetFirewallRule -DisplayName "Allow ICMP" ` +
    `-Direction Inbound -Protocol ICMPv4 -IcmpType 8 -Action Allow -Profile Any;
    } else {
      Set-NetFirewallRule -DisplayName "Allow ICMP" -Enabled True;
    }
    # also enable the built-in ping rule
    Enable-NetFirewallRule -Name "FPS-ICMP4-ERQ-In";
  `;

  exec(
    `powershell.exe -NoProfile -Command '${psCommand}'`,
    { encoding: 'utf8' },
    (error, stdout, stderr) => {
      if (error) {
        console.error(
          Constants.TEXT_RED_COLOR,
          "Couldn't enable ICMP ping on host",
          error,
        );
      } else {
        //console.log(Constants.TEXT_GREEN_COLOR, stdout.trim());
        console.log(Constants.TEXT_GREEN_COLOR, 'ICMP ping enabled');
      }
    },
  );
}
