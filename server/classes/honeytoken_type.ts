import { HoneytokenType } from '../interfaces/type';
import { Honeytoken } from './honeytoken';
import { Monitor_Text } from './monitor_type';

export class Honeytoken_Text extends Honeytoken {
  location: string;
  file_name: string;
  notes: string;
  agent: Monitor_Text;

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
    super(token_id, group_id, type, expirationDate, grade);
    this.location = location;
    this.file_name = file_name;
    this.notes = notes;
    this.agent = new Monitor_Text(this.location + '\\' + this.file_name, this);
  }

  getNotes(): string {
    return this.notes!;
  }

  setNotes(notes: string): void {
    this.notes = notes;
  }

  startAgent(): void {
    this.agent.monitor();
  }

  createFile(data: string): void {
    //TODO: create the file in this.location
  }

  getFileName(): string {
    return this.file_name;
  }

  getLocation(): string {
    return this.location;
  }
}
