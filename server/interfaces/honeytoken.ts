import { HoneytokenType } from './type'

export interface I_Honeytoken {
  getTokenID(): string
  getGroupID(): string
  getType(): HoneytokenType
  getCreationDate(): Date
  getExpirationDate(): Date
  isExpired(): boolean
  isTriggered(): boolean
  getNotes(): string
}

export interface I_HoneytokenManager {
  createTokens(token_type: HoneytokenType, numOfTokens: number): void
  deleteTokens(groupID: string): void
}

export interface I_HoneytokenScatter {
  manualPlacement(tokens: I_Honeytoken[], where: any): void
  autoPlacement(tokens: I_Honeytoken[]): void
}
