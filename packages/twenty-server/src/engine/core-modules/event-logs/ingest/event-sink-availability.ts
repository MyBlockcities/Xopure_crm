export const KNOWN_SINK_NAMES = ['clickhouse', 'console', 'otlp'] as const;

export const getAvailableSinkNames = (
  configuredSinkNames: string[],
  { hasClickhouseUrl }: { hasClickhouseUrl: boolean },
): string[] =>
  configuredSinkNames.filter((name) => {
    const lowerCasedName = name.toLowerCase();

    if (lowerCasedName === 'clickhouse') {
      return hasClickhouseUrl;
    }

    if (lowerCasedName === 'console') {
      return true;
    }

    if (lowerCasedName === 'otlp') {
      return true;
    }

    return false;
  });
