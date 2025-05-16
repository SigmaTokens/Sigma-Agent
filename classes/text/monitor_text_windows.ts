import { exec } from 'child_process';
import { Constants } from '../../constants.ts';
import { Honeytoken_Text } from './honeytoken_text.ts';
import { sleep } from '../../utilities/utilities.ts';
import { Monitor_Text } from './monitor_text.ts';

export class Monitor_Text_Windows extends Monitor_Text {
  constructor(file: string, token: Honeytoken_Text) {
    super(file, token);
  }

  async stop_monitor(lightStop: boolean = true) {
    super.stop_monitor(lightStop);
    await this.remove_audit_rule_windows();
    console.log(Constants.TEXT_GREEN_COLOR, `Stopped monitoring ${this.file}`);
  }

  async start_monitor() {
    super.start_monitor();
    this.monitorWindows(); // ✅ don’t await the infinite loop
    console.log(Constants.TEXT_GREEN_COLOR, `Started monitoring ${this.file}`);
    this.shouldSendAlerts = true;
    console.log(Constants.TEXT_GREEN_COLOR, `Alerts enabled for ${this.file}`);
  }

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

  private async monitorWindows() {
    console.log(`Called startMonitor() on token ${this.token.token_id}`);
    await this.add_audit_rule_windows();
    const monitorLoop = async () => {
      while (true) {
        await this.get_latest_event_for_target_windows();
        await sleep(5000);
      }
    };
    monitorLoop(); // spawn async background loop
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

  extract_access_date_from_event_windows(event: any): Date {
    const match = event.TimeCreated.match(/\/Date\((\d+)\)\//);
    const millis = parseInt(match[1], 10);
    const accessDate = new Date(millis);
    return accessDate;
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
}
