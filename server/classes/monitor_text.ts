import fs from 'fs';
import { Monitor } from './Monitor';
import { exec } from 'child_process';
import { Constants } from '../constants';
import { isWindows, isMac, isLinux } from '../utilities/host';
import { sleep } from '../utilities/utilities';
import { Honeytoken_Text } from './honeytoken_text';

export class Monitor_Text extends Monitor {
  file: string;
  token: Honeytoken_Text;
  last_access_time: Date;
  not_first_log: boolean;

  constructor(file: string, token: Honeytoken_Text) {
    super();
    this.file = file;
    this.token = token;
    this.last_access_time = new Date();
    this.not_first_log = false;
  }

  async start_monitor() {
    if (isWindows()) {
      this.monitorWindows();
    } else if (isMac()) {
      this.monitorMac();
    } else if (isLinux()) {
      this.monitorLinux();
    }
  }

  async stop_monitor() {}

  // -------- WINDOWS --------
  async monitorWindows() {
    await this.add_audit_rule_windows();
    while (true) {
      await this.get_latest_event_for_target_windows();
      await sleep(500);
    }
  }

  async add_audit_rule_windows() {
    const psCommand = `$path = '${this.file}';
                                            $acl = Get-Acl $path;
                                            $auditRule = New-Object System.Security.AccessControl.FileSystemAuditRule('Everyone','Read','None','None','Success');
                                            $acl.SetAuditRule($auditRule);
                                            Set-Acl -Path $path -AclObject $acl;
                                            Write-Output "Audit rule set successfully on $path";`;

    const oneLinePsCommand = psCommand
      .replace(/\r?\n+/g, ';')
      .replace(/;+/g, ';');
    const command = `powershell.exe -NoProfile -Command "${oneLinePsCommand}"`;
    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(
          Constants.TEXT_RED_COLOR,
          `Error adding auditing rule to ${this.file} : ${error}`,
        );
      }
      console.log(
        Constants.TEXT_GREEN_COLOR,
        `Successfully added audit_rule to ${this.file}}`,
      );
    });
  }

  async get_latest_event_for_target_windows() {
    const psCommand =
      "$target='" +
      this.file +
      "'; " +
      "Get-WinEvent -LogName Security -FilterXPath '*[System[(EventID=4663)]]' -MaxEvents 100 | " +
      'Where-Object { $_.ToXml() -match [regex]::Escape($target) } | ' +
      'Sort-Object TimeCreated -Descending | ' +
      'Select-Object -First 1 | ConvertTo-Json -Depth 4';

    exec(
      `powershell.exe -NoProfile -Command "${psCommand.replace(/\r?\n/g, ';')}"`,
      { encoding: 'utf8' },
      (error, stdout, stderr) => {
        if (error) {
          console.error(
            Constants.TEXT_RED_COLOR,
            'Error fetching event:',
            error,
          );
        } else {
          if (stdout) {
            const eventData = JSON.parse(stdout);
            const accessDate =
              this.extract_access_date_from_event_windows(eventData);
            if (accessDate > this.last_access_time) {
              //Globals.alerts
              //if new_alert is in Global.alerts - then skip
              this.last_access_time = accessDate;
              if (this.not_first_log) {
                const jsonData = JSON.stringify(eventData, null, 2);

                const subjectAccount = eventData.Properties[1].Value;
                const subjectDomain = eventData.Properties[2].Value;

                console.log('Token was accessed:', subjectAccount);
                const postData = {
                  token_id: this.token.token_id,
                  alert_epoch: accessDate.getTime(),
                  accessed_by: subjectDomain + '/' + subjectAccount,
                  log: jsonData,
                };

                fetch('http://' + process.env.SERVER_IP + ':3000/api/alerts', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(postData),
                })
                  .then((response) => {
                    if (!response.ok) {
                      throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                  })
                  .then((data) => {
                    console.log('Successfully posted alert:', data);
                  })
                  .catch((error) => {
                    console.error('Error posting alert:', error);
                  });
              }
            } else this.not_first_log = true;
          }
        }
      },
    );
  }

  extract_access_date_from_event_windows(event: any): Date {
    const match = event.TimeCreated.match(/\/Date\((\d+)\)\//);
    const millis = parseInt(match[1], 10);
    const accessDate = new Date(millis);
    return accessDate;
  }

  // -------- LINUX --------
  async monitorLinux() {
    await this.add_audit_rule_linux();
    while (true) {
      await this.get_latest_event_for_target_linux();
      await sleep(500);
    }
  }

  async add_audit_rule_linux() {
    const command = `sudo auditctl -w ${this.file} -p r -k honeytoken_access`;
    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(
          Constants.TEXT_RED_COLOR,
          `Error adding audit rule to ${this.file}: ${error}`,
        );
        return;
      }
      console.log(
        Constants.TEXT_GREEN_COLOR,
        `Successfully added audit rule to ${this.file}`,
      );
    });
  }

  async get_latest_event_for_target_linux() {
    const command = `sudo ausearch -k honeytoken_access -ts recent -l | head -n 1`;

    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(
          Constants.TEXT_RED_COLOR,
          'Error fetching audit event:',
          error,
        );
      } else if (stdout) {
        const eventData = this.parse_auditd_log_linux(stdout);
        const accessDate = new Date(eventData.time);

        if (accessDate > this.last_access_time) {
          this.last_access_time = accessDate;

          if (this.not_first_log) {
            const jsonData = JSON.stringify(eventData, null, 2);
            const subjectAccount = eventData.uid;
            const subjectDomain = eventData.host;

            console.log('Token was accessed by:', subjectAccount);
            const postData = {
              token_id: 'test',
              access_time: accessDate.getTime(),
              accessor: `${subjectDomain}/${subjectAccount}`,
              event_data: jsonData,
            };

            fetch(`http://${process.env.SERVER_IP}:3000/api/alerts`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(postData),
            })
              .then((response) => {
                if (!response.ok)
                  throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
              })
              .then((data) => console.log('Successfully posted alert:', data))
              .catch((error) => console.error('Error posting alert:', error));
          }
        } else {
          this.not_first_log = true;
        }
      }
    });
  }

  parse_auditd_log_linux(log: string): any {
    const result: any = {};

    log.split('\n').forEach((line) => {
      if (line.startsWith('time->')) {
        result.time = line.replace('time->', '');
      } else if (line.includes('uid=')) {
        const uidMatch = line.match(/uid=(\d+)/);
        const hostMatch = line.match(/hostname=([^\s]+)/);

        result.uid = uidMatch ? uidMatch[1] : 'unknown';
        result.host = hostMatch ? hostMatch[1] : 'unknown';
      }
    });

    return result;
  }

  // -------- MAC --------
  async monitorMac() {
    await this.enable_fsevents_mac();
    while (true) {
      await this.check_fsevents_mac();
      await sleep(500);
    }
  }

  async enable_fsevents_mac() {
    const command =
      `sudo touch ${this.file} && ` +
      `sudo chmod 444 ${this.file} && ` +
      `sudo log config --mode "private_data:on" && ` +
      `sudo log config --subsystem "com.apple.fseventsd" --mode "level:debug"`;

    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(
          Constants.TEXT_RED_COLOR,
          `Error setting up fsevents monitoring: ${error}`,
        );
        return;
      }
      console.log(
        Constants.TEXT_GREEN_COLOR,
        `Successfully configured fsevents monitoring for ${this.file}`,
      );
    });
  }

  async check_fsevents_mac() {
    const command =
      `log show --predicate 'eventMessage contains "${this.file}"' ` +
      `--style json --last 1m --info --debug`;

    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(
          Constants.TEXT_RED_COLOR,
          'Error querying fsevents:',
          error,
        );
        return;
      }

      try {
        const logs = JSON.parse(stdout);
        const latestEvent = logs.find(
          (e: any) =>
            e.eventMessage.includes(this.file) && e.eventType === 'open',
        );

        if (latestEvent) {
          const accessDate = new Date(latestEvent.timestamp);
          if (accessDate > this.last_access_time) {
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

              fetch(`http://${process.env.SERVER_IP}:3000/api/alerts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postData),
              }).then(/* ... */);
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
