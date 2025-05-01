import { I_HoneytokenMonitor } from '../interfaces/monitor.ts';

export abstract class Monitor implements I_HoneytokenMonitor {
  abstract start_monitor(): void;
  abstract stop_monitor(): void;
}
