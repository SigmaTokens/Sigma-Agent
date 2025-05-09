import { exec } from 'child_process';
import { Constants } from '../../constants.ts';
import { last_501, sleep } from '../../utilities/utilities.ts';
import { Honeytoken_Text } from './honeytoken_text.ts';
import { Monitor_Text } from './monitor_text.ts';

export class Monitor_Text_Linux extends Monitor_Text {
  constructor(file: string, token: Honeytoken_Text) {
    super(file, token);
  }

  async stop_monitor(lightStop: boolean = true) {
    super.stop_monitor(lightStop);
    await this.remove_audit_rule_linux();
    console.log(Constants.TEXT_GREEN_COLOR, `Stopped monitoring ${this.file}`);
  }

  async start_monitor() {
    super.start_monitor();
    await this.monitorLinux();
    console.log(Constants.TEXT_GREEN_COLOR, `Started monitoring ${this.file}`);

    this.shouldSendAlerts = true;
    console.log(Constants.TEXT_GREEN_COLOR, `Alerts enabled for ${this.file}`);
  }

  async monitorLinux() {
    await this.add_audit_rule_linux();
    while (true) {
      await this.get_latest_event_for_target_linux();
      await sleep(500);
    }
  }

  async get_latest_event_for_target_linux() {
    console.log('start get_latest_event_for_target_linux');
    const startTime = await last_501();
    const command = `sudo ausearch -k honeytoken_access -ts ${startTime}`;

    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(Constants.TEXT_RED_COLOR, 'Error fetching audit event:', error);
      } else if (stdout) {
        (async () => {
          const eventData = await this.parse_auditd_log_linux(stdout);
          for (const event of eventData) {
            const accessDate = new Date(event.time);
            if (accessDate > this.last_access_time && this.shouldSendAlerts) {
              this.last_access_time = accessDate;

              if (this.not_first_log) {
                const jsonData = JSON.stringify(event, null, 2);
                const subjectAccount = event.uid;
                const subjectDomain = event.host;

                console.log('Token was accessed by:', subjectAccount);
                const postData = {
                  token_id: this.token.token_id,
                  alert_epoch: accessDate.getTime(),
                  accessed_by: subjectDomain + '/' + subjectAccount,
                  log: jsonData,
                };

                fetch(`http://${process.env.MANAGER_IP}:3000/api/alerts`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(postData),
                })
                  .then((response) => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.json();
                  })
                  .then((data) => console.log('Successfully posted alert:', data))
                  .catch((error) => console.error('Error posting alert:', error));
              }
            } else {
              this.not_first_log = true;
            }
          }
        })();
      }
    });
  }

  async parse_auditd_log_linux(log: string): Promise<any> {
    console.log('start parse_auditd_log_linux');

    const entries = log.split('----');
    const results: any[] = [];

    for (const entry of entries) {
      const result: any = {};
      const lines = entry.split('\n');

      for (const line of lines) {
        if (line.startsWith('time->')) {
          result.time = line.replace('time->', '').trim();
        } else if (line.includes('type=SYSCALL')) {
          const uidMatch = line.match(/uid=(\d+)/);
          const auidMatch = line.match(/auid=(\d+)/);

          result.uid = uidMatch ? uidMatch[1] : undefined;
          result.host = await new Promise((resolve, reject) => {
            exec(`id -un ${result.uid}`, { encoding: 'utf8' }, (error, stdout, stderr) => {
              if (error) {
                console.error(Constants.TEXT_RED_COLOR, 'Error fetching hostname:', error);
                resolve(undefined);
              } else if (stdout) {
                const subjectAccount = stdout.trim();
                resolve(subjectAccount);
              } else {
                resolve(undefined);
              }
            });
          });

          result.auid = auidMatch ? auidMatch[1] : undefined;
        } else if (line.includes('type=PATH') && line.includes('nametype=NORMAL')) {
          const pathMatch = line.match(/name="([^"]+)"/);
          if (pathMatch) {
            result.file = pathMatch[1];
          }
        }
      }

      results.push(result);
    }

    return results;
  }

  private async remove_audit_rule_linux() {
    const command = `sudo auditctl -W ${this.file} -k honeytoken_access`;

    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(Constants.TEXT_RED_COLOR, `Error removing audit rule from ${this.file}: ${error}`);
        return;
      }
      console.log(Constants.TEXT_GREEN_COLOR, `Successfully removed audit rules from ${this.file}`);
    });
  }

  async add_audit_rule_linux() {
    const command = `sudo auditctl -w ${this.file} -p rwa -k honeytoken_access`;
    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(Constants.TEXT_RED_COLOR, `Error adding audit rule to ${this.file}: ${error}`);
        return;
      }
      console.log(Constants.TEXT_GREEN_COLOR, `Successfully added audit rule to ${this.file}`);
    });
  }
}
