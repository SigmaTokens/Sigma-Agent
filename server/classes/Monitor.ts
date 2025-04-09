import { I_HoneytokenMonitor } from "../interfaces/monitor";

export abstract class Monitor implements I_HoneytokenMonitor {
	abstract monitor(): void;
}
