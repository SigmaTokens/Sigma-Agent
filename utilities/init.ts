import { Globals } from '../globals.ts';
import { Honeytoken_Text } from '../classes/text/honeytoken_text.ts';
import { networkInterfaces } from 'os';
import { Constants } from '../constants.ts';
import { API_route, HoneytokenType, Token } from './typing.ts';
import { Honeytoken_API } from '../classes/api/honeytoken_api.ts';

export async function initHoneytokens() {
  const results = await Globals.socket.emitWithAck('GET_HONEYTOKENS', process.env[Constants.AGENT_ID_VARIABLE]);
  const tokens: Token[] = results.tokens;

  const groups = tokens.reduce(
    (acc, token: Token) => {
      if (!acc[token.group_id]) {
        acc[token.group_id] = [];
      }
      acc[token.group_id].push(token);
      return acc;
    },
    {} as Record<string, Token[]>,
  );

  for (const [group_id, tokens] of Object.entries(groups)) {
    const hasApi = tokens.some((tok: Token) => tok.type_id === HoneytokenType.API);

    if (hasApi) {
      const header = tokens[0];
      let routes: API_route[] = [];

      for (const tokenData of tokens) {
        const route: API_route = {
          method: tokenData.http_method,
          route: tokenData.route,
          response: tokenData.response,
        };
        routes.push(route);
      }

      const api_token: Honeytoken_API = await Honeytoken_API.create(
        header.group_id,
        new Date(header.expire_date),
        header.grade,
        header.api_port,
        routes,
      );
      Globals.api_honeytokens.push(api_token);
    } else {
      for (const tokenData of tokens) {
        switch (tokenData.type_id) {
          case HoneytokenType.Text:
            try {
              const text_honeytoken = await Honeytoken_Text.create(
                tokenData.token_id,
                tokenData.group_id,
                tokenData.type_id,
                new Date(tokenData.expire_date),
                tokenData.grade,
                tokenData.notes,
                tokenData.location,
                tokenData.file_name,
              );

              Globals.text_honeytokens.push(text_honeytoken);
            } catch (err) {
              console.log(Constants.TEXT_RED_COLOR, `Error creating token: ${tokenData.token_id}`);
            }
          default:
        }
      }
    }
  }
}

export function getLocalIPv4s(): string[] {
  const ifaces = networkInterfaces();
  const virtualInterfaceRegex = /^(lo|docker|vmnet|veth|br-|tun|utun|vEthernet)/i;

  // 1) Find the “priority” address: first wifi, otherwise first non-virtual
  let priority: string | null = null;
  for (const [name, list] of Object.entries(ifaces)) {
    if (!list) continue;
    if (/wifi/i.test(name)) {
      const wifiAddr = list.find((i) => i.family === 'IPv4' && !i.internal);
      if (wifiAddr) {
        priority = wifiAddr.address;
        break;
      }
    }
  }
  if (!priority) {
    for (const [name, list] of Object.entries(ifaces)) {
      if (!list || virtualInterfaceRegex.test(name)) continue;
      const addr = list.find((i) => i.family === 'IPv4' && !i.internal);
      if (addr) {
        priority = addr.address;
        break;
      }
    }
  }

  // 2) Collect _all_ non-internal IPv4s (from every interface)
  const allAddrs: string[] = [];
  for (const list of Object.values(ifaces)) {
    if (!list) continue;
    for (const i of list) {
      if (i.family === 'IPv4' && !i.internal) {
        allAddrs.push(i.address);
      }
    }
  }

  // 3) De-duplicate and reorder so `priority` is first
  const uniques = Array.from(new Set(allAddrs));
  if (priority) {
    const withoutPri = uniques.filter((ip) => ip !== priority);
    return [priority, ...withoutPri];
  }

  // 4) Fallback: if nothing found, return loopback
  return uniques.length > 0 ? uniques : ['127.0.0.1'];
}
