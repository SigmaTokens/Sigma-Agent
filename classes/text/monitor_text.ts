import { Monitor } from '../abstract/Monitor.ts';
import { Constants } from '../../constants.ts';
import { isWindows, isMac, isLinux } from '../../utilities/host.ts';
import { Honeytoken_Text } from './honeytoken_text.ts';

export abstract class Monitor_Text extends Monitor {
  file: string;
  token: Honeytoken_Text;
  last_access_time: Date;
  not_first_log: boolean;
  shouldSendAlerts: boolean;
  isMonitoring: boolean;

  public static async getInstance(file: string, token: Honeytoken_Text): Promise<Monitor_Text> {
    if (isWindows()) {
      const m = await import('./monitor_text_windows.ts');
      return new m.Monitor_Text_Windows(file, token);
    } else if (isMac()) {
      const m = await import('./monitor_text_mac.ts');
      return new m.Monitor_Text_Mac(file, token);
    } else {
      const m = await import('./monitor_text_linux.ts');
      return new m.Monitor_Text_Linux(file, token);
    }
  }

  constructor(file: string, token: Honeytoken_Text) {
    super();
    this.file = file;
    this.token = token;
    this.last_access_time = new Date();
    this.not_first_log = false;
    this.shouldSendAlerts = true;
    this.isMonitoring = false;
  }

  stop_monitor(lightStop: boolean = true) {
    if (lightStop) {
      this.shouldSendAlerts = false;
      console.log(Constants.TEXT_YELLOW_COLOR, `Alerts paused for ${this.file}`);
    } else {
      this.isMonitoring = false;
      this.shouldSendAlerts = false;
    }
  }

  start_monitor() {
    if (!this.isMonitoring) {
      this.isMonitoring = true;
    }
  }
}
