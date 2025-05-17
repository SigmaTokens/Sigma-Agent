import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { tmpdir } from 'os';
import { writeFileSync } from 'fs';
import { join } from 'path';

export class ReadWatcher {
  private dtraceProc?: ChildProcessWithoutNullStreams;

  constructor(private readonly filePath: string) {}

  /** Start monitoring the file for open/read syscalls via DTrace */
  public start(): void {
    if (process.platform !== 'darwin') {
      console.warn('🔍 ReadWatcher (DTrace) only runs on macOS—skipping.');
      return;
    }

    const script = `
      syscall::open*:entry
      /copyinstr(arg0) == "${this.filePath}"/
      {
        printf("%Y %s opened by pid %d\\n", walltimestamp, copyinstr(arg0), pid);
      }
    `;

    // Write the DTrace script to a temp file
    const scriptPath = this.writeScriptToTemp(script);

    // Spawn dtrace with stdin/stdout/stderr all as pipes
    this.dtraceProc = spawn('sudo', ['dtrace', '-s', scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // You can still ignore stdin if you like, but it's a Writable now
    this.dtraceProc.stdin!.end();

    // Listen for events
    this.dtraceProc.stdout.on('data', (buf) => this.onRead(buf.toString()));
    this.dtraceProc.stderr.on('data', (buf) => console.error('DTrace stderr:', buf.toString()));

    console.log(`🛠 spawned dtrace with script at ${scriptPath}`);
  }

  /** Stop the DTrace watcher */
  public stop(): void {
    if (this.dtraceProc) {
      this.dtraceProc.kill();
      console.log('⏹ Stopped DTrace watcher');
    }
  }

  /** Handle a read/open event line from DTrace */
  private onRead(line: string): void {
    console.log('📣 Read event:', line.trim());
    // ...your alert logic here...
  }

  /** Helper: write the DTrace script to a temp .d file and return its path */
  private writeScriptToTemp(script: string): string {
    const tmpPath = join(tmpdir(), `read-watch-${Date.now()}.d`);
    writeFileSync(tmpPath, script, { encoding: 'utf8' });
    return tmpPath;
  }
}
