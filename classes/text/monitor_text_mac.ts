import { watchFile, unwatchFile, Stats } from 'fs';
import { Constants } from '../../constants.ts';
import { Honeytoken_Text } from './honeytoken_text.ts';
import { Monitor_Text } from './monitor_text.ts';
import { ReadWatcher } from './dummy.ts';
export class Monitor_Text_Mac extends Monitor_Text {
  private fileListener?: (curr: Stats, prev: Stats) => void;
  private readListener: ReadWatcher;
  constructor(file: string, token: Honeytoken_Text) {
    super(file, token);
    this.readListener = new ReadWatcher(this.file);
  }

  async start_monitor() {
    super.start_monitor();
    this.shouldSendAlerts = true;

    // store the listener so we can remove it later
    this.fileListener = (curr, prev) => {
      if (curr.atimeMs > prev.atimeMs && this.shouldSendAlerts) {
        this.onAccess(curr);
      }
    };

    this.readListener.start();
    watchFile(this.file, { interval: 5000 }, this.fileListener);
    console.log(Constants.TEXT_GREEN_COLOR, `Started monitoring ${this.file}`);
  }

  private onAccess(stat: Stats) {
    const accessDate = new Date(stat.atimeMs);
    if (accessDate > this.last_access_time) {
      this.last_access_time = accessDate;
      // Build your alert payload however you like; you won’t get the rich eventData
      const postData = {
        token_id: this.token.token_id,
        alert_epoch: accessDate.getTime(),
        accessed_by: 'macOS fs.watchFile',
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
    if (this.fileListener) {
      // remove only this listener
      unwatchFile(this.file, this.fileListener);
    } else {
      // or remove all watchers on this.file
      unwatchFile(this.file);
    }
    console.log(Constants.TEXT_GREEN_COLOR, `Stopped monitoring ${this.file}`);
  }
}
