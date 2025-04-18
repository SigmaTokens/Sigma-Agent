import isElevated from 'is-elevated';
import { Globals } from '../globals';

export async function isAdmin(): Promise<boolean> {
  return isElevated();
}

export async function isFromManager(origin: string): Promise<boolean> {
  if (origin || origin.startsWith(Globals.manager_url)) return true;
  return false;
}
