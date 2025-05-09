import { exec } from 'child_process';
import { Constants } from '../../constants.ts';
import { Honeytoken_Text } from './honeytoken_text.ts';
import { Monitor_Text } from './monitor_text.ts';
import { sleep } from '../../utilities/utilities.ts';

export class Monitor_Text_Mac extends Monitor_Text {
  constructor(file: string, token: Honeytoken_Text) {
    super(file, token);
  }

  async stop_monitor(lightStop: boolean = true) {
    super.stop_monitor(lightStop);
    await this.disable_fsevents_mac();
    console.log(Constants.TEXT_GREEN_COLOR, `Stopped monitoring ${this.file}`);
  }

  async start_monitor() {
    super.start_monitor();
    await this.monitorMac();
    console.log(Constants.TEXT_GREEN_COLOR, `Started monitoring ${this.file}`);

    this.shouldSendAlerts = true;
    console.log(Constants.TEXT_GREEN_COLOR, `Alerts enabled for ${this.file}`);
  }

  async monitorMac() {
    await this.enable_fsevents_mac();
    while (true) {
      await this.check_fsevents_mac();
      await sleep(500);
    }
  }

  private async disable_fsevents_mac() {
    const command =
      `sudo log config --subsystem "com.apple.fseventsd" --mode "level:default" && ` + `sudo chmod 644 ${this.file}`;

    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(Constants.TEXT_RED_COLOR, `Error disabling fsevents monitoring: ${error}`);
        return;
      }
      console.log(Constants.TEXT_GREEN_COLOR, `Successfully disabled fsevents monitoring for ${this.file}`);
    });
  }

  async enable_fsevents_mac() {
    const command =
      `sudo touch ${this.file} && ` +
      `sudo chmod 444 ${this.file} && ` +
      `sudo log config --mode "private_data:on" && ` +
      `sudo log config --subsystem "com.apple.fseventsd" --mode "level:debug"`;

    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(Constants.TEXT_RED_COLOR, `Error setting up fsevents monitoring: ${error}`);
        return;
      }
      console.log(Constants.TEXT_GREEN_COLOR, `Successfully configured fsevents monitoring for ${this.file}`);
    });
  }

  async check_fsevents_mac() {
    const command =
      `log show --predicate 'eventMessage contains "${this.file}"' ` + `--style json --last 1m --info --debug`;

    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(Constants.TEXT_RED_COLOR, 'Error querying fsevents:', error);
        return;
      }

      try {
        const logs = JSON.parse(stdout);
        const latestEvent = logs.find((e: any) => e.eventMessage.includes(this.file) && e.eventType === 'open');

        if (latestEvent) {
          const accessDate = new Date(latestEvent.timestamp);
          if (accessDate > this.last_access_time && this.shouldSendAlerts) {
            this.last_access_time = accessDate;

            if (this.not_first_log) {
              const processInfo = latestEvent.process.split('[')[0].trim();
              const pidMatch = latestEvent.process.match(/\[(\d+)\]/);
              const pid = pidMatch ? pidMatch[1] : 'unknown';

              console.log(`Token accessed by ${processInfo} (PID: ${pid})`);
              const postData = {
                token_id: 'test',
                access_time: accessDate.getTime(),
                accessor: `${processInfo}/${pid}`,
                event_data: JSON.stringify(latestEvent, null, 2),
              };

              fetch(`http://${process.env.MANAGER_IP}:3000/api/alerts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postData),
              }).then();
            }
          } else {
            this.not_first_log = true;
          }
        }
      } catch (parseError) {
        console.error('Error parsing fsevents log:', parseError);
      }
    });
  }
}
