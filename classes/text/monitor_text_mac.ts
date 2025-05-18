import { spawn, ChildProcess } from 'child_process';
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

    // Spawn fs_usage (requires root)
    this.fsUsageProcess = spawn('fs_usage', ['-w', '-f', 'filesys']);
    if (this.fsUsageProcess.stdout) {
      this.fsUsageProcess.stdout.setEncoding('utf8');

      this.fsUsageProcess.stdout.on('data', (chunk: string) => {
        for (const line of chunk.split('\n')) {
          if (line.includes(this.file)) {
            stat(this.file, (err, stats: Stats) => {
              if (err) return console.error('stat error:', err);
              // Compare against last_access_time (a Date on the base class)
              if (stats.atimeMs > this.last_access_time.getTime()) {
                this.onAccess(stats);
              }
            });
          }
        }
      });
    }

    if (this.fsUsageProcess.stderr) {
      this.fsUsageProcess.stderr.on('data', (data) => console.error('fs_usage error:', data.toString()));
    }

    console.log(Constants.TEXT_GREEN_COLOR, `Started monitoring ${this.file} via fs_usage`);
  }

  private onAccess(stat: Stats) {
    const accessDate = new Date(stat.atimeMs);
    if (accessDate > this.last_access_time) {
      this.last_access_time = accessDate;

      const postData = {
        token_id: this.token.token_id,
        alert_epoch: accessDate.getTime(),
        accessed_by: 'macOS fs_usage',
      };

      console.log('sigma:', postData);
      fetch(`http://${process.env.MANAGER_IP}:${process.env.MANAGER_PORT}/api/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      }).catch((err) => console.error('Error posting alert:', err));
    }
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
