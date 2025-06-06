import { HoneytokenType } from '../utilities/typing.ts';

export interface I_Honeytoken {
  getTokenID(): string;
  getGroupID(): string;
  getType(): HoneytokenType;
  getCreationDate(): Date;
  getExpirationDate(): Date;
  isExpired(): boolean;
  isTriggered(): boolean;
}
