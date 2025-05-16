import { exec } from 'child_process';
import { Constants } from '../../constants.ts';
import { Honeytoken_Text } from './honeytoken_text.ts';
import { sleep } from '../../utilities/utilities.ts';
import { Monitor_Text } from './monitor_text.ts';

export class Monitor_Text_Linux extends Monitor_Text {
  private auditKey: string;

  constructor(file: string, token: Honeytoken_Text) {
    super(file, token);
    // Use a unique audit key for ausearch
    // e.g., "token_<token_id>"
    this.auditKey = `token_${this.token.token_id}`;
  }

  /**
   * Starts monitoring:
   *  1. Calls super.start_monitor()
   *  2. Adds Linux audit rule
   *  3. Spawns the infinite monitor loop (non-awaited)
   */
  async start_monitor(): Promise<void> {
    super.start_monitor();
    await this.start_audit_rule_linux();
    this.monitor_loop_linux(); // Do NOT await the infinite loop

    console.log(Constants.TEXT_GREEN_COLOR, `Started monitoring ${this.file}`);
    this.shouldSendAlerts = true;
    console.log(Constants.TEXT_GREEN_COLOR, `Alerts enabled for ${this.file}`);
  }

  /**
   * Stops monitoring:
   *  1. Calls super.stop_monitor()
   *  2. Removes Linux audit rule
   */
  async stop_monitor(lightStop: boolean = true): Promise<void> {
    super.stop_monitor(lightStop);
    await this.remove_audit_rule_linux();
    console.log(Constants.TEXT_GREEN_COLOR, `Stopped monitoring ${this.file}`);
  }

  /**
   * Adds a Linux audit rule (using auditctl) to watch for read access to this.file.
   * Example: sudo auditctl -w /path/to/file -p r -k this.auditKey
   */
  private async start_audit_rule_linux(): Promise<void> {
    const command = `sudo auditctl -w "${this.file}" -p r -k "${this.auditKey}"`;
    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(
          Constants.TEXT_RED_COLOR,
          `Error adding audit rule for ${this.file}: ${error}`,
        );
        return;
      }
      console.log(
        Constants.TEXT_GREEN_COLOR,
        `Successfully added audit rule for ${this.file} (key=${this.auditKey})`,
      );
    });
  }

  /**
   * Removes the previously added Linux audit rule.
   * Example: sudo auditctl -W /path/to/file -p r -k this.auditKey
   */
  private async remove_audit_rule_linux(): Promise<void> {
    const command = `sudo auditctl -W "${this.file}" -p r -k "${this.auditKey}"`;
    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(
          Constants.TEXT_RED_COLOR,
          `Error removing audit rule from ${this.file}: ${error}`,
        );
        return;
      }
      console.log(
        Constants.TEXT_GREEN_COLOR,
        `Successfully removed audit rule from ${this.file} (key=${this.auditKey})`,
      );
    });
  }

  /**
   * Monitors events in a continuous loop, every 5s.
   */
  private async monitor_loop_linux(): Promise<void> {
    console.log(`Called monitor_loop_linux() on token ${this.token.token_id}`);

    while (true) {
      await this.get_latest_event_for_target_linux();
      await sleep(5000);
    }
  }

  /**
   * Retrieves the most recent audit event for the monitored file,
   * checks if it’s newer than the last known access time, and sends an alert.
   * Example command: ausearch -k token_<token_id> -i --limit 1
   * (You can adjust flags to produce more parse-friendly output if desired.)
   */
  private async get_latest_event_for_target_linux(): Promise<void> {
    // Limit to 1 event, interpret fields for readability
    const command = `sudo ausearch -k "${this.auditKey}" -i --limit 1`;

    exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
      // If there's no event, ausearch may return a message like "no matches"
      if (error || !stdout || /no matches/i.test(stdout)) {
        // Possibly ignore or log "no events found"
        return;
      }

      // Each event can span multiple lines, but we only took --limit 1.
      // Attempt to parse out timestamp, user, or exe as needed.
      const lines = stdout.trim().split('\n');
      // Extract the approximate "audit(epoch:record_id)" line
      const dateMatch = stdout.match(/audit\((\d+\.\d+):\d+\):/);
      if (!dateMatch) {
        // If we don't find a date, no further action
        return;
      }

      const eventDate = this.extract_access_date_from_event_linux(dateMatch[1]);

      // Only trigger an alert if new event and alerts are enabled
      if (eventDate > this.last_access_time && this.shouldSendAlerts) {
        this.last_access_time = eventDate;

        // Skip sending alert for the very first log after start
        if (this.not_first_log) {
          // Extract the process name (exe=...) if needed
          const exeMatch = stdout.match(/exe="([^"]+)"/);
          const accessedProgram = exeMatch ? exeMatch[1] : 'unknown';

          // For demonstration, skip certain programs
          if (Constants.LINUX_EXCLUDE_PROGRAMS_REGEX?.test(accessedProgram)) {
            return;
          }

          // Construct your log or alert payload
          const postData = {
            token_id: this.token.token_id,
            alert_epoch: eventDate.getTime(),
            accessed_by: this.extract_user_from_event_linux(stdout),
            log: stdout, // Full text of the event
          };

          // Submit alert to manager
          fetch(`http://${process.env.MANAGER_IP}:3000/api/alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData),
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              return response.json();
            })
            .catch((postError) => {
              console.error('Error posting alert:', postError);
            });
        } else {
          this.not_first_log = true;
        }
      }
    });
  }

  /**
   * Converts the "epoch" portion from an ausearch line into a Date object.
   * e.g. "1684245678.123" -> Date
   */
  private extract_access_date_from_event_linux(epochString: string): Date {
    // epochString = "1684245678.123" (seconds.millis)
    const epochSec = parseFloat(epochString); // in seconds
    const epochMs = Math.round(epochSec * 1000); // convert to ms
    return new Date(epochMs);
  }

  /**
   * Optional helper to parse out a username or domain from audit output.
   */
  private extract_user_from_event_linux(auditOutput: string): string {
    // Example lines might contain: "uid=1000 username=\"john\""
    const userMatch = auditOutput.match(/uid=\d+\s+.*?\s+user(?:name)?="([^"]+)"/);
    if (userMatch) {
      return userMatch[1];
    }
    return 'unknown_user';
  }
}
