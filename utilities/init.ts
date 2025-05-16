import { Globals } from '../globals.ts';
import { Honeytoken_Text } from '../classes/text/honeytoken_text.ts';
import { networkInterfaces } from 'os';

export async function initHoneytokens(): Promise<void> {
  try {
    const serverUrl = `http://${process.env.MANAGER_IP}:${process.env.MANAGER_PORT}/api/honeytokens/agent`;

    const requestBody = { agent_ip: getLocalIPv4s()[0], agent_port: Globals.port };

    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const tokens = await response.json();

    if (!Array.isArray(tokens)) {
      throw new Error('Invalid response format: expected array of honeytokens');
    }

    Globals.tokens = [];

    for (const tokenData of tokens) {
      try {
        const token = new Honeytoken_Text(
          tokenData.token_id,
          tokenData.group_id,
          tokenData.type_id,
          new Date(tokenData.expire_date),
          tokenData.grade,
          tokenData.notes,
          tokenData.location,
          tokenData.file_name,
        );
        Globals.tokens.push(token);
      } catch (tokenError) {
        console.error('Failed to initialize token:', tokenError);
      }
    }

    console.log(`Successfully initialized ${Globals.tokens.length} honeytokens`);
  } catch (error) {
    console.error('Failed to initialize honeytokens:', error);
    Globals.tokens = [];
    throw error;
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
