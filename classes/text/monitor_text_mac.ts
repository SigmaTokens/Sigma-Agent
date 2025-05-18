import { spawn, ChildProcess, exec } from 'child_process';
import { stat, Stats } from 'fs';
import { Constants } from '../../constants.ts';
import { Honeytoken_Text } from './honeytoken_text.ts';
import { Monitor_Text } from './monitor_text.ts';

export class Monitor_Text_Mac extends Monitor_Text {
  private fsUsageProcess?: ChildProcess;

  constructor(file: string, token: Honeytoken_Text) {
    super(file, token);
  }

  async start_monitor() {
    super.start_monitor();
    this.shouldSendAlerts = true;

    // Spawn fs_usage in pipe mode to capture stdout/stderr
    this.fsUsageProcess = spawn('fs_usage', ['-w', '-f', 'filesys'], { stdio: ['ignore', 'pipe', 'pipe'] });

    const stdout = this.fsUsageProcess.stdout!;
    stdout.setEncoding('utf8');
    stdout.on('data', (chunk: string) => {
      // Log the raw chunk so you can see timestamp, spaces, etc.
      console.log('[DEBUG fs_usage raw chunk]\n', chunk);

      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue;

        // Log each individual line
        console.log('[DEBUG fs_usage line] "', line, '"');

        if (!line.includes(this.file)) {
          console.log('[DEBUG] ➔ does not include target file, skipping');
          continue;
        }

        // Try matching PID and process name — log the match array
        const regex = /^\s*\d{2}:\d{2}:\d{2}(?:\.\d+)?\s+(\S+)\[(\d+)\]/;
        const match = line.match(regex);
        console.log('[DEBUG regex match] ', match);

        const procName = match ? match[1] : 'NO-PROC';
        const pid = match ? match[2] : 'NO-PID';
        console.log(`[DEBUG] extracted procName="${procName}", pid="${pid}"`);

        // … then your stat() + handleAccess(pid) as before …
      }
    });

    const stderr = this.fsUsageProcess.stderr!;
    stderr.on('data', (data) => console.error('fs_usage error:', data.toString()));

    console.log(Constants.TEXT_GREEN_COLOR, `Started monitoring ${this.file} via fs_usage`);
  }

  private handleAccess(stat: Stats, pid: string) {
    const accessDate = new Date(stat.atimeMs);
    if (accessDate > this.last_access_time) {
      this.last_access_time = accessDate;
      // Lookup the user that performed the access via lsof
      if (pid) {
        exec(`lsof -p ${pid} | awk 'NR==2 {print $3}'`, (err, stdout) => {
          const user = err ? 'unknown' : stdout.trim() || 'unknown';
          this.sendAlert(accessDate, user);
        });
      } else {
        this.sendAlert(accessDate, 'unknown');
      }
    }
  }

  private sendAlert(accessDate: Date, user: string) {
    const postData = {
      token_id: this.token.token_id,
      alert_epoch: accessDate.getTime(),
      accessed_by: user,
    };

    console.log('sigma:', postData);
    fetch(`http://${process.env.MANAGER_IP}:${process.env.MANAGER_PORT}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData),
    }).catch((err) => console.error('Error posting alert:', err));
  }

  async stop_monitor() {
    super.stop_monitor();
    if (this.fsUsageProcess) {
      this.fsUsageProcess.kill();
      this.fsUsageProcess = undefined;
    }
    console.log(Constants.TEXT_GREEN_COLOR, `Stopped monitoring ${this.file}`);
  }
}
