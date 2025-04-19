import isElevated from 'is-elevated';
import { Globals } from '../globals';

export async function isAdmin(): Promise<boolean> {
  return isElevated();
}

export async function isFromManager(origin: string): Promise<boolean> {
  if (
    origin ||
    origin.startsWith(process.env.SERVER_IP + ':' + process.env.SERVER_PORT)
  )
    return true;
  return false;
}
