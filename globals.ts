import { I_Honeytoken } from './interfaces/honeytoken.ts';
import { Socket } from 'socket.io-client';

export class Globals {
  public static port: number;
  public static app: any = null;
  public static text_honeytokens: I_Honeytoken[] = [];
  public static api_honeytokens: I_Honeytoken[] = [];
  public static socket: Socket;
}
