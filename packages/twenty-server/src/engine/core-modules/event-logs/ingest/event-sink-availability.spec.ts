import {
  getAvailableSinkNames,
  KNOWN_SINK_NAMES,
} from 'src/engine/core-modules/event-logs/ingest/event-sink-availability';

describe('getAvailableSinkNames', () => {
  it('returns ["otlp"] when otlp is configured and ClickHouse is absent', () => {
    const result = getAvailableSinkNames(['otlp'], {
      hasClickhouseUrl: false,
    });

    expect(result).toEqual(['otlp']);
  });

  it('accepts mixed-case OTLP and preserves original casing', () => {
    const result = getAvailableSinkNames(['OTLP'], {
      hasClickhouseUrl: false,
    });

    expect(result).toEqual(['OTLP']);
  });

  it('includes otlp alongside clickhouse when both are configured', () => {
    const result = getAvailableSinkNames(['clickhouse', 'otlp'], {
      hasClickhouseUrl: true,
    });

    expect(result).toContain('otlp');
  });

  it('registers "otlp" in KNOWN_SINK_NAMES', () => {
    expect(KNOWN_SINK_NAMES).toContain('otlp');
  });
});
