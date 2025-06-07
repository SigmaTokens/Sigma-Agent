import { HoneytokenType } from '../../utilities/typing.ts';
import { Honeytoken } from '../abstract/Honeytoken.ts';
import { API_route } from '../../utilities/typing.ts';
import express from 'express';
import { Constants } from '../../constants.ts';

export class Honeytoken_API extends Honeytoken {
  api_port: number;
  apis: API_route[];
  is_monitoring: boolean;
  sub_application: any;

  private constructor(group_id: string, expirationDate: Date, grade: number, api_port: number, apis: API_route[]) {
    super('', group_id, HoneytokenType.API, expirationDate, grade, '');
    this.api_port = api_port;
    this.apis = apis;
    this.is_monitoring = true;

    this.sub_application = express();
    this.sub_application.use(express.json());

    apis.forEach(({ method, route, response }: API_route) => {
      this.sub_application[method.toLowerCase()](route, (req: any, res: any) => {
        console.log(Constants.TEXT_YELLOW_COLOR, `got request at: ${method}   ${route}`);
        if (this.is_monitoring) {
          const logString = JSON.stringify({
            ips: req.ips || [],
            method: req.method,
            path: req.originalUrl,
            headers: req.headers,
            body: req.body,
            params: req.params,
            query: req.query,
          });

          const postData = {
            token_id: this.group_id,
            alert_epoch: new Date().getTime(),
            accessed_by: req.ip,
            log: logString,
          };

          fetch(`http://${process.env.MANAGER_IP}:${process.env.MANAGER_PORT}/api/alerts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(postData),
          }).catch((error) => {
            console.error('Error posting alert:', error);
          });

          res.status(200).json(response);
        } else {
          res.status(500).json({});
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
    this.is_monitoring = true;
  }

  stopMonitor() {
    this.is_monitoring = false;
  }

  isMonitoring(): boolean {
    return this.is_monitoring;
  }
}
