import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

export class ReadWatcher {
  private dtraceProc?: ChildProcessWithoutNullStreams;
  private filePath?: string;
  constructor(filePath: string) {
    this.filePath = filePath;
  }
  public start() {
    console.log('starting to monitor reading');
    const script = `
      syscall::open*:entry
      /copyinstr(arg0) == "${this.filePath}"/
      { printf("%Y %s opened by pid %d\n", walltimestamp, copyinstr(arg0), pid); }
    `;

    // now stderr is a pipe rather than `null`
    this.dtraceProc = spawn('sudo', ['dtrace', '-s', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.dtraceProc.stdin.write(script);
    this.dtraceProc.stdin.end();

    // no more TS errors — all streams are guaranteed
    this.dtraceProc.stdout.on('data', (buf) => this.onRead(buf.toString()));
    this.dtraceProc.stderr.on('data', (buf) => console.error('DTrace stderr:', buf.toString()));
  }

  public stop() {
    this.dtraceProc?.kill();
    console.log('Stopped DTrace watcher');
  }

  public onRead(line: string) {
    console.log('DTRACE EVENT:', line.trim());
  }
}
