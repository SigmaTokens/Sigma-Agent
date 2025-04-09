import fs from "fs";
import { Monitor } from "./Monitor";
import { exec } from "child_process";
import { Constants } from "../constants";
import { isWindows, isMac } from "../utilities/host";
import { stderr } from "process";
import { sleep } from "../utilities/utilities";
import { Honeytoken_Text } from "./Honeytoken_Text";


export class Monitor_Text extends Monitor {
	file: string;
	token: Honeytoken_Text;
	last_access_time: Date;
	not_first_log: boolean;
	fsUsageProcess: any; // To store the fs_usage process

	constructor(file: string, token: Honeytoken_Text) {
		super();
		this.file = file;
		this.token = token;
		this.last_access_time = new Date();
		this.not_first_log = false;
	}

	async monitor() {
		if (isWindows()) {
			this.monitorWindows();
		} else if (isMac()) {
			this.monitorMac();
		}
	}

	// -------- WINDOWS --------
	async monitorWindows() {
		await this.add_audit_rule();
		while (true) {
			await this.get_latest_event_for_target();
			await sleep(500);
		}
	}

	async add_audit_rule() {
		const psCommand = `$path = '${this.file}';
                                            $acl = Get-Acl $path;
                                            $auditRule = New-Object System.Security.AccessControl.FileSystemAuditRule('Everyone','Read','None','None','Success');
                                            $acl.SetAuditRule($auditRule);
                                            Set-Acl -Path $path -AclObject $acl;
                                            Write-Output "Audit rule set successfully on $path";`;

		const oneLinePsCommand = psCommand.replace(/\r?\n+/g, ";").replace(/;+/g, ";");
		const command = `powershell.exe -NoProfile -Command "${oneLinePsCommand}"`;
		exec(command, { encoding: "utf8" }, (error, stdout, stderr) => {
			if (error) {
				console.error(Constants.TEXT_RED_COLOR, `Error adding auditing rule to ${this.file} : ${error}`);
			}
			console.log(Constants.TEXT_GREEN_COLOR, `Successfully added audit_rule to ${this.file}}`);
		});
	}

	async get_latest_event_for_target() {
		const psCommand =
			"$target='" +
			this.file +
			"'; " +
			"Get-WinEvent -LogName Security -FilterXPath '*[System[(EventID=4663)]]' -MaxEvents 100 | " +
			"Where-Object { $_.ToXml() -match [regex]::Escape($target) } | " +
			"Sort-Object TimeCreated -Descending | " +
			"Select-Object -First 1 | ConvertTo-Json -Depth 4";

		exec(
			`powershell.exe -NoProfile -Command "${psCommand.replace(/\r?\n/g, ";")}"`,
			{ encoding: "utf8" },
			(error, stdout, stderr) => {
				if (error) {
					console.error(Constants.TEXT_RED_COLOR, "Error fetching event:", error);
				} else {
					if (stdout) {
						const eventData = JSON.parse(stdout);
						const accessDate = this.extract_access_date_from_event(eventData);
						if (accessDate > this.last_access_time) {
							this.last_access_time = accessDate;
							if (this.not_first_log) {
								const jsonData = JSON.stringify(eventData, null, 2);

								const subjectAccount = eventData.Properties[1].Value;
								const subjectDomain = eventData.Properties[2].Value;

								// TODO: check whether the last alert doesn't already exists in the db
								// TODO: replace the "test" with actual stuff
								console.log("Token was accessed:", subjectAccount);
								// create_alert_to_token_id(
								// 	Globals.app.locals.db,
								// 	"test",
								// 	accessDate.getTime(),
								// 	subjectDomain + "/" + subjectAccount,
								// 	jsonData
								// );
							}
						} else this.not_first_log = true;
					}
				}
			}
		);
	}

	extract_access_date_from_event(event: any): Date {
		const match = event.TimeCreated.match(/\/Date\((\d+)\)\//);
		const millis = parseInt(match[1], 10);
		const accessDate = new Date(millis);
		return accessDate;
	}

	// -------- macOS --------
	async monitorMac() {
		this.add_fsusage_rule();
	}

	add_fsusage_rule() {
		const fsUsageCommand = `sudo fs_usage -f filesys | grep "${this.file}"`;

		this.fsUsageProcess = exec(fsUsageCommand, { encoding: "utf8" }, (error, stdout, stderr) => {
			if (error) {
				console.error(Constants.TEXT_RED_COLOR, `Error running fs_usage: ${error}`);
			}
		});

		this.fsUsageProcess.stdout.on("data", (data: string) => {
			const accessDate = new Date(); // fs_usage output doesn't contain a date
			if (accessDate > this.last_access_time) {
				this.last_access_time = accessDate;
				if (this.not_first_log) {
					console.log("File accessed: " + data);
					// TODO: write the alert into the alerts table in the database.
				} else this.not_first_log = true;
			}
		});

		this.fsUsageProcess.stderr.on("data", (data: string) => {
			console.error(Constants.TEXT_RED_COLOR, `fs_usage stderr: ${data}`);
		});
	}
}
