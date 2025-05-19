import { isWindows, isMac, isLinux } from './host.ts';

export async function isAdmin(): Promise<boolean> {
  if (isWindows()) {
    const isElevated = await import('is-elevated');
    return await isElevated.default();
  } else if (isLinux() || isMac()) {
    // On POSIX (Linux & mac), root has UID 0
    return typeof process.getuid === 'function' && process.getuid() === 0;
  }
  return false;
}

export async function isFromManager(origin: string): Promise<boolean> {
  if (origin || origin.startsWith(process.env.MANAGER_IP + ':' + process.env.MANAGER_PORT)) return true;
  return false;
}
