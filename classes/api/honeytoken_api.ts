import { HoneytokenType } from '../../utilities/typing.ts';
import { Honeytoken } from '../abstract/Honeytoken.ts';
import { API_route } from '../../utilities/typing.ts';

export class Honeytoken_API extends Honeytoken {
  api_port: number;
  apis: API_route[];
  is_monitoring: boolean = false;

  private constructor(group_id: string, expirationDate: Date, grade: number, api_port: number, apis: API_route[]) {
    super('', group_id, HoneytokenType.API, expirationDate, grade, '');
    this.api_port = api_port;
    this.apis = apis;
  }

  public static async create(
    group_id: string,
    expirationDate: Date,
    grade: number,
    api_port: number,
    apis: API_route[],
  ): Promise<Honeytoken_API> {
    const instance = new Honeytoken_API(group_id, expirationDate, grade, api_port, apis);
    return instance;
  }

  startMonitor() {
    //
  }

  stopMonitor() {
    //
  }
}
