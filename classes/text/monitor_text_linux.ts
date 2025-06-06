import { spawn, ChildProcess } from 'child_process';
import { stat, Stats } from 'fs';
import { Constants } from '../../constants.ts';
import { Honeytoken_Text } from './honeytoken_text.ts';
import { Monitor_Text } from './monitor_text.ts';
import os from 'os';

export class Monitor_Text_Linux extends Monitor_Text {
  private watcherProcess?: ChildProcess;

  constructor(file: string, token: Honeytoken_Text) {
    super(file, token);
  }

  async start_monitor() {
    super.start_monitor();
    this.shouldSendAlerts = true;

    // Spawn inotifywait to monitor open/access/modify events
    const cmd = `inotifywait -m -e open,access,modify --format '%T %e %w%f' --timefmt '%F %T' ${this.file}`;
    this.watcherProcess = spawn('bash', ['-lc', cmd], { stdio: ['ignore', 'pipe', 'pipe'] });

    const stdout = this.watcherProcess.stdout!;
    stdout.setEncoding('utf8');
    stdout.on('data', (chunk: string) => {
      const rawLog = chunk;
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Format: "YYYY-MM-DD HH:MM:SS EVENT /path/to/file"
        const parts = trimmed.split(/\s+/);
        if (parts.length < 4) continue;
        const eventType = parts[2];
        const filePath = parts.slice(3).join(' ');
        if (filePath !== this.file) continue;

        // Use current time for alert timestamp
        const accessDate = new Date();
        if (accessDate.getTime() > this.last_access_time.getTime()) {
          this.last_access_time = accessDate;
          const user = os.userInfo().username;
          this.sendAlert(accessDate, user, eventType, rawLog);
        }
      }
    });

    const stderr = this.watcherProcess.stderr!;
    stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Setting up watches') || msg.includes('Watches established')) {
        return;
      }
      console.error('inotifywait error:', msg);
    });

    console.log(Constants.TEXT_GREEN_COLOR, `Started monitoring ${this.file} via inotifywait`, Constants.TEXT_WHITE_COLOR);
  }

  private sendAlert(accessDate: Date, user: string, event: string, rawLog: string) {
    const postData = {
      token_id: this.token.token_id,
      alert_epoch: accessDate.getTime(),
      accessed_by: user,
      event: event,
      log: JSON.stringify({ inotify: rawLog }),
    };

    // console.log(Constants.TEXT_YELLOW_COLOR, `Alert for ${this.file} at ${accessDate.toISOString()} by ${user}: ${event}`, Constants.TEXT_WHITE_COLOR);
    fetch(`http://${process.env.MANAGER_IP}:${process.env.MANAGER_PORT}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData),
    }).catch((err) => console.error('Error posting alert:', err));
  }

  async stop_monitor() {
    super.stop_monitor();
    if (this.watcherProcess) {
      this.watcherProcess.kill('SIGINT');
      await new Promise<void>((resolve) => this.watcherProcess!.once('exit', () => resolve()));
      this.watcherProcess = undefined;
    }
    console.log(Constants.TEXT_YELLOW_COLOR, `Stopped monitoring ${this.file}`, Constants.TEXT_WHITE_COLOR);
  }
}
