import { Globals } from '../globals';
import { isWindows, isMac, isLinux } from './host';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function isAdmin(): Promise<boolean> {
  if (isWindows()) {
    const isElevated = await import('is-elevated');
    return await isElevated.default();
  } else if (isLinux()) {
    return process.getuid !== undefined && process.getuid() === 0;
  } else if (isMac()) {
    try {
      const { stdout } = await execPromise('id -u');
      return parseInt(stdout.trim(), 10) === 0; // 0 indicates root user
    } catch (error) {
      console.error('Error checking admin status on Mac:', error);
      return false;
    }
  }
  
  return false;
}

export async function isFromManager(origin: string): Promise<boolean> {
  if (
    origin ||
    origin.startsWith(process.env.SERVER_IP + ':' + process.env.SERVER_PORT)
  ) {
    return true;
  }
  return false;
}
