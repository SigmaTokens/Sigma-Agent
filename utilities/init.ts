import { Globals } from '../globals.ts';
import { Honeytoken_Text } from '../classes/honeytoken_text.ts';

export async function initHoneytokens(): Promise<void> {
  try {
    const serverUrl = `http://${process.env.SERVER_IP}:3000/api/honeytokens/agent`;

    const requestBody = { agent_ip: '127.0.0.1', agent_port: 9007 };

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

    // Clear existing tokens before adding new ones
    Globals.tokens = [];

    // Validate and add tokens
    for (const tokenData of tokens) {
      try {
        // Create new Honeytoken_Text instance instead of type assertion
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
        // Continue with next token even if one fails
      }
    }

    console.log(
      `Successfully initialized ${Globals.tokens.length} honeytokens`,
    );
  } catch (error) {
    console.error('Failed to initialize honeytokens:', error);
    Globals.tokens = []; // Reset to empty array on failure
    throw error; // Re-throw if you want calling code to handle the error
  }
}
