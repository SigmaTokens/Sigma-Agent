export enum HoneytokenType {
  Text = 'text',
  API = 'api',
}

export type API_route = {
  method: string;
  route: string;
  response: string;
};

export type Token = {
  token_id: string;
  group_id: string;
  type_id: HoneytokenType;
  grade: number;
  creation_date: number;
  expire_date: string;
  location: string;
  file_name: string;
  http_method: string;
  route: string;
  data: string;
  response: string;
  notes: string;
  api_port: number;
};
