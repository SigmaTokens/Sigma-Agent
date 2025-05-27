import { I_Honeytoken } from './interfaces/honeytoken.ts';
import { Socket } from 'socket.io-client';
export class Globals {
  public static port: number;
  public static app: any = null;
  public static tokens: I_Honeytoken[] = [];
  public static socket: Socket;
}
