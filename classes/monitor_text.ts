import fs from 'fs';
import { Monitor } from './Monitor.ts';
import { exec } from 'child_process';
import { Constants } from '../constants.ts';
import { isWindows, isMac, isLinux } from '../utilities/host.ts';
import { sleep, last_501 } from '../utilities/utilities.ts';
import { Honeytoken_Text } from './honeytoken_text.ts';

export class Monitor_Text extends Monitor {
  file: string;
  token: Honeytoken_Text;
  last_access_time: Date;
  not_first_log: boolean;
  shouldSendAlerts: boolean;
  isMonitoring: boolean;

  constructor(file: string, token: Honeytoken_Text) {
    super();
    this.file = file;
    this.token = token;
    this.last_access_time = new Date();
    this.not_first_log = false;
    this.shouldSendAlerts = true;
    this.isMonitoring = false;
  }

  async stop_monitor(lightStop: boolean = true) {
    if (lightStop) {
      this.shouldSendAlerts = false;
      console.log(Constants.TEXT_YELLOW_COLOR, `Alerts paused for ${this.file}`);
    } else {
      this.isMonitoring = false;
      this.shouldSendAlerts = false;

      if (isWindows()) {
        await this.remove_audit_rule_windows();
      } else if (isMac()) {
        await this.disable_fsevents_mac();
      } else if (isLinux()) {
        await this.remove_audit_rule_linux();
      }

      console.log(Constants.TEXT_GREEN_COLOR, `Stopped monitoring ${this.file}`);
    }
  }

  async start_monitor() {
    if (!this.isMonitoring) {
      this.isMonitoring = true;

      if (isWindows()) {
        await this.monitorWindows();
      } else if (isMac()) {
        await this.monitorMac();
      } else if (isLinux()) {
        await this.monitorLinux();
      }

      console.log(Constants.TEXT_GREEN_COLOR, `Started monitoring ${this.file}`);
    }

    this.shouldSendAlerts = true;
    console.log(Constants.TEXT_GREEN_COLOR, `Alerts enabled for ${this.file}`);
  }

  // -------- WINDOWS --------
  private async remove_audit_rule_windows() {
    const psCommand = `$path = '${this.file}';
                      $acl = Get-Acl $path;
                      $acl.AuditRules.Clear();
                      Set-Acl -Path $path -AclObject $acl;
                      Write-Output "Audit rules removed successfully from $path";`;

    const command = `powershell.exe -NoProfile -Command "${psCommand.replace(/\r?\n/g, ';')}"`;

    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(Constants.TEXT_RED_COLOR, `Error removing audit rule from ${this.file}: ${error}`);
        return;
      }
      console.log(Constants.TEXT_GREEN_COLOR, `Successfully removed audit rules from ${this.file}`);
    });
  }

  // -------- LINUX --------
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

  // -------- MAC --------
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

    const oneLinePsCommand = psCommand.replace(/\r?\n+/g, ';').replace(/;+/g, ';');
    const command = `powershell.exe -NoProfile -Command "${oneLinePsCommand}"`;
    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(Constants.TEXT_RED_COLOR, `Error adding auditing rule to ${this.file} : ${error}`);
      }
      console.log(Constants.TEXT_GREEN_COLOR, `Successfully added audit_rule to ${this.file}}`);
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
        if (error && Constants.NO_EVENTS_REGEX.test((error.stderr ?? '').toString())) {
          console.error(Constants.TEXT_RED_COLOR, 'Error fetching event:', error);
        } else {
          if (stdout) {
            const eventData = JSON.parse(stdout);
            const accessDate = this.extract_access_date_from_event_windows(eventData);
            if (accessDate > this.last_access_time && this.shouldSendAlerts) {
              this.last_access_time = accessDate;
              if (this.not_first_log) {
                const jsonData = JSON.stringify(eventData, null, 2);

                const subjectAccount = eventData.Properties[1].Value;
                const subjectDomain = eventData.Properties[2].Value;
                const accessProgram = eventData.Properties[11].Value;

                if (Constants.WIN32_EXCLUDE_PROGRAMS_REGEX.test(accessProgram)) {
                  return;
                }

                const postData = {
                  token_id: this.token.token_id,
                  alert_epoch: accessDate.getTime(),
                  accessed_by: subjectDomain + '/' + subjectAccount,
                  log: jsonData,
                };

                fetch('http://' + process.env.MANAGER_IP + ':3000/api/alerts', {
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
    const command = `sudo auditctl -w ${this.file} -p rwa -k honeytoken_access`;
    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(Constants.TEXT_RED_COLOR, `Error adding audit rule to ${this.file}: ${error}`);
        return;
      }
      console.log(Constants.TEXT_GREEN_COLOR, `Successfully added audit rule to ${this.file}`);
    });
  }

  async get_latest_event_for_target_linux() {
    console.log('start get_latest_event_for_target_linux');
    const startTime = await last_501();
    const command = `sudo ausearch -k honeytoken_access -ts ${startTime}`;

    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(Constants.TEXT_RED_COLOR, 'Error fetching audit event:', error);
      } else if (stdout) {
        const eventData = this.parse_auditd_log_linux(stdout);
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
                token_id: 'test',
                access_time: accessDate.getTime(),
                accessor: `${subjectDomain}/${subjectAccount}`,
                event_data: jsonData,
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
      }
    });
  }

  parse_auditd_log_linux(log: string): any {
    console.log('start parse_auditd_log_linux');
    console.log(log);
    const entries = log
      .trim()
      .split('----')
      .map((block) => block.trim())
      .filter(Boolean);
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
          const commMatch = line.match(/comm="([^"]+)"/);
          const exeMatch = line.match(/exe="([^"]+)"/);

          result.uid = uidMatch ? uidMatch[1] : undefined;
          result.auid = auidMatch ? auidMatch[1] : undefined;
          result.command = commMatch ? commMatch[1] : undefined;
          result.exe = exeMatch ? exeMatch[1] : undefined;
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
