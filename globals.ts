import { Honeytoken_API } from './classes/api/honeytoken_api.ts';
import { Honeytoken_Text } from './classes/text/honeytoken_text.ts';
import { I_Honeytoken } from './interfaces/honeytoken.ts';
import { Socket } from 'socket.io-client';

export class Globals {
  public static port: number;
  public static app: any = null;
  public static text_honeytokens: Honeytoken_Text[] = [];
  public static api_honeytokens: Honeytoken_API[] = [];
  public static socket: Socket;
}
