import { spawn, ChildProcess } from 'child_process';
import { stat, Stats } from 'fs';
import { Constants } from '../../constants.ts';
import { Honeytoken_Text } from './honeytoken_text.ts';
import { Monitor_Text } from './monitor_text.ts';
import { Globals } from '../../globals.ts';
import os from 'os';

export class Monitor_Text_Mac extends Monitor_Text {
  private fsUsageProcess?: ChildProcess;

  constructor(file: string, token: Honeytoken_Text) {
    super(file, token);
  }

  async start_monitor() {
    super.start_monitor();
    this.shouldSendAlerts = true;

    // Spawn fs_usage with upstream filtering: include target file, exclude stat64/statfs64
    const escapedPath = this.file.replace(/\//g, '\\/');
    const cmd = `fs_usage -w -f filesys \
      | grep "${escapedPath}" \
      | grep -vE "stat64|statfs64"`;

    this.fsUsageProcess = spawn('bash', ['-lc', cmd], { stdio: ['ignore', 'pipe', 'pipe'] });

    const stdout = this.fsUsageProcess.stdout!;
    stdout.setEncoding('utf8');
    stdout.on('data', (chunk: string) => {
      const rawLog = chunk;
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Extract process name and PID: ends with "processName.pid"
        const procPidMatch = trimmed.match(/(\S+)\.(\d+)$/);
        const procName = procPidMatch ? procPidMatch[1] : '';
        const pid = procPidMatch ? procPidMatch[2] : '';

        // Fresh stat to check atime
        stat(this.file, (err, stats: Stats) => {
          if (err) return console.error('stat error:', err);
          if (stats.atimeMs > this.last_access_time.getTime()) {
            this.handleAccess(stats, pid, procName, rawLog);
          }
        });
      }
    });

    const stderr = this.fsUsageProcess.stderr!;
    stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('ktrace_start: Resource busy')) return;
      console.error('fs_usage error:', msg);
    });

    console.log(Constants.TEXT_GREEN_COLOR, `Started monitoring ${this.file} via filtered fs_usage`);
  }

  private handleAccess(stat: Stats, pid: string, procName: string, rawLog: string) {
    const accessDate = new Date(stat.atimeMs);
    if (accessDate > this.last_access_time) {
      this.last_access_time = accessDate;
      const user = os.userInfo().username;
      this.sendAlert(accessDate, user, pid, procName, rawLog);
    }
  }

  private sendAlert(accessDate: Date, user: string, pid: string, procName: string, rawLog: string) {
    Globals.socket.emit('CREATE_ALERT', {
      token_id: this.token.token_id,
      alert_epoch: accessDate.getTime(),
      accessed_by: user,
      process: procName,
      pid: pid,
      log: JSON.stringify({ fs_usage: rawLog }),
    });
  }

  async stop_monitor() {
    super.stop_monitor();
    if (this.fsUsageProcess) {
      this.fsUsageProcess.kill('SIGINT');
      await new Promise<void>((resolve) => this.fsUsageProcess!.once('exit', () => resolve()));
      this.fsUsageProcess = undefined;
    }
    console.log(Constants.TEXT_GREEN_COLOR, `Stopped monitoring ${this.file}`);
  }
}
