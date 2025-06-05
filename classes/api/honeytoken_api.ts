import { HoneytokenType } from '../../utilities/typing.ts';
import { Honeytoken } from '../abstract/Honeytoken.ts';
import { API_route } from '../../utilities/typing.ts';
import express from 'express';

export class Honeytoken_API extends Honeytoken {
  api_port: number;
  apis: API_route[];
  is_monitoring: boolean = false;
  sub_application: any;

  private constructor(group_id: string, expirationDate: Date, grade: number, api_port: number, apis: API_route[]) {
    super('', group_id, HoneytokenType.API, expirationDate, grade, '');
    this.api_port = api_port;
    this.apis = apis;

    this.sub_application = express();
    this.sub_application.use(express.json());

    apis.forEach(({ method, route, response }: API_route) => {
      this.sub_application[method.toLowerCase()](route, (req: any, res: any) => {
        if (this.is_monitoring) {
          // TODO: do some monitoring

          // send alert back to the manager
          res.status(200).json(response);
        } else {
          res.status(500);
        }
      });
    });

    this.sub_application.listen(api_port, () => {
      console.log(`API sub application listening on port ${api_port}`);
    });
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
    this.is_monitoring = false;
  }

  stopMonitor() {
    this.is_monitoring = true;
  }
}
