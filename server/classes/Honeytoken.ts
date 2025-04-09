import { I_Honeytoken } from "../interfaces/honeytoken";
import { HoneytokenType } from "../interfaces/type";

export abstract class Honeytoken implements I_Honeytoken {
	token_id: string;
	group_id: string;
	type: HoneytokenType;
	creationDate: Date;
	expirationDate: Date;
	grade: number;
	notes: string;

	constructor(
		token_id: string,
		group_id: string,
		type: HoneytokenType,
		expirationDate: Date,
		grade: number,
		notes: string
	) {
		this.token_id = token_id;
		this.group_id = group_id;
		this.type = type;
		this.creationDate = new Date();
		// TODO: if expiration date is initial - add 30 days from today
		this.expirationDate = expirationDate;
		this.grade = grade;
		this.notes = notes;
	}

	getTokenID(): string {
		return this.token_id;
	}
	getGroupID(): string {
		return this.group_id;
	}
	getType(): HoneytokenType {
		return this.type;
	}
	getCreationDate(): Date {
		return this.creationDate!;
	}
	setCreationDate(creationDate: Date): void {
		this.creationDate = creationDate;
	}
	getExpirationDate(): Date {
		return this.expirationDate!;
	}
	setExpirationDate(expirationDate: Date): void {
		this.expirationDate = expirationDate;
	}
	isExpired(): boolean {
		return this.expirationDate! < new Date();
	}
	isTriggered(): boolean {
		//TODO: implement db request through alerts
		throw new Error("Method not implemented.");
	}
	getNotes(): string {
		return this.notes!;
	}
	setNotes(notes: string): void {
		this.notes = notes;
	}
	getGrade(): number {
		return this.grade;
	}
}
