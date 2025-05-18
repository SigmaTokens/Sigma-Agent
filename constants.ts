export class Constants {
  public static readonly TEXT_RED_COLOR = '\x1b[31m';
  public static readonly TEXT_GREEN_COLOR = '\x1b[32m';
  public static readonly TEXT_YELLOW_COLOR = '\x1b[33m';
  public static readonly NO_EVENTS_REGEX = /No events were found/;
  public static readonly WIN32_EXCLUDE_PROGRAMS_REGEX = /explorer.exe|Code.exe|SearchProtocolHost.exe/;
  public static readonly MAC_EXCLUDE_PROGRAMS_REGEX =
    /Finder|fileproviderd|QuickLookUIHelper|mdwrite|mds|filecoordinationd|mdworker_shared/;
  public static readonly AGENT_ID_VARIABLE = 'AGENT_ID';
  public static readonly DEFAULT_AGENT_PORT = '9007';
}
