import isElevated from 'is-elevated';

export async function isAdmin(): Promise<boolean> {
  return isElevated();
}

export async function isFromManager(origin: string): Promise<boolean> {
  if (origin || origin.startsWith('http://localhost:3000')) return true;
  return false;
}
