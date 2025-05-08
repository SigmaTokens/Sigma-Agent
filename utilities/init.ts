import { Globals } from '../globals.ts';
import { Honeytoken_Text } from '../classes/text/honeytoken_text.ts';

export async function initHoneytokens(): Promise<void> {
  try {
    const serverUrl = `http://${process.env.MANAGER_IP}:3000/api/honeytokens/agent`;

    const requestBody = { agent_ip: '127.0.0.1', agent_port: 9007 }; //TODO: needs to change this ?!

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
          tokenData.type,
          new Date(tokenData.expirationDate),
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
