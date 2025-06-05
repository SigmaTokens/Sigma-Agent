import { HoneytokenType } from '../../utilities/typing.ts';
import { Honeytoken } from '../abstract/Honeytoken.ts';
import { Monitor_Text } from './monitor_text.ts';
import fs from 'fs';
import path from 'path';

export class Honeytoken_Text extends Honeytoken {
  location: string;
  file_name: string;
  agent!: Monitor_Text;
  is_monitoring: boolean = false;

  private constructor(
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
    this.is_monitoring = false;
  }

  public static async create(
    token_id: string,
    group_id: string,
    type: HoneytokenType,
    expirationDate: Date,
    grade: number,
    notes: string,
    location: string,
    file_name: string,
  ): Promise<Honeytoken_Text> {
    const inst = new Honeytoken_Text(token_id, group_id, type, expirationDate, grade, notes, location, file_name);
    inst.agent = await Monitor_Text.getInstance(path.join(location, file_name), inst);
    return inst;
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

  startMonitor() {
    this.agent.start_monitor();
    this.is_monitoring = true;
  }

  stopMonitor() {
    this.agent.stop_monitor();
    this.is_monitoring = false;
  }
}
