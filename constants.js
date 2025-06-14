export class Constants {
  static TEXT_RED_COLOR = '\x1b[31m';
  static TEXT_GREEN_COLOR = '\x1b[32m';
  static TEXT_YELLOW_COLOR = '\x1b[33m';
  static TEXT_CYAN_COLOR = '\x1b[36m';
  static TEXT_MAGENTA_COLOR = '\x1b[35m';
  static TEXT_DEFAULT_COLOR = '\x1b[37m';
  static NO_EVENTS_REGEX = /No events were found/;
  static WIN32_EXCLUDE_PROGRAMS_REGEX = /explorer.exe|Code.exe|SearchProtocolHost.exe/;
  static MAC_EXCLUDE_PROGRAMS_REGEX = /Finder/;
  static LINUX_EXCLUDE_PROGRAMS_REGEX = /.../;
  static AGENT_ID_VARIABLE = 'AGENT_ID';
  static DEFAULT_AGENT_PORT = '9007';
}
