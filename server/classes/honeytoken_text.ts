import { HoneytokenType } from '../interfaces/type';
import { Honeytoken } from './Honeytoken';
import { Monitor_Text } from './monitor_text';
import fs from 'fs';
import path from 'path';

export class Honeytoken_Text extends Honeytoken {
  location: string;
  file_name: string;
  agent: Monitor_Text;
  is_monitoring: boolean = false;

  constructor(
    token_id: string,
    group_id: string,
    type: HoneytokenType,
    expirationDate: Date,
    grade: number,
    notes: string,
    location: string,
    file_name: string,
  ) {
    super(token_id, group_id, type, expirationDate, grade, notes);
    this.location = location;
    this.file_name = file_name;
    this.notes = notes;
    this.agent = new Monitor_Text(this.location + '\\' + this.file_name, this);
    this.is_monitoring = false;
  }

  getFileName(): string {
    return this.file_name;
  }

  getLocation(): string {
    return this.location;
  }

  createFile(data: string): void {
    try {
      if (!fs.existsSync(this.location)) {
        fs.mkdirSync(this.location, { recursive: true });
      }

      const fullPath = path.join(this.location, this.file_name);

      fs.writeFileSync(fullPath, data, { encoding: 'utf8' });

      console.log(`File created at: ${fullPath}`);
    } catch (error) {
      console.error(`Error creating file: ${error}`);
      throw error;
    }
  }

  isMonitoring(): boolean {
    return this.is_monitoring;
  }

  startMonitor(): void {
    this.agent.start_monitor();
    this.is_monitoring = true;
  }

  stopMonitor(): void {
    this.agent.stop_monitor();
    this.is_monitoring = false;
  }
}
