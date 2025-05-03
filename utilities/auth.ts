import { isWindows, isMac, isLinux } from './host.ts';

export async function isAdmin(): Promise<boolean> {
  if (isWindows()) {
    const isElevated = await import('is-elevated');
    return await isElevated.default();
  } else if (isLinux()) {
    return process.getuid !== undefined && process.getuid() === 0;
  } else if (isMac()) {
    console.log('Running on Mac');
  }
  return false;
}

export async function isFromManager(origin: string): Promise<boolean> {
  if (origin || origin.startsWith(process.env.MANAGER_IP + ':' + process.env.MANAGER_PORT)) return true;
  return false;
}
