import isElevated from 'is-elevated';

export async function isAdmin(): Promise<boolean> {
  return isElevated();
}
