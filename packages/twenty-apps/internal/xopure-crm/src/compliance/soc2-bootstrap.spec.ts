import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  startSoc2EvidenceFlusher,
  stopSoc2EvidenceFlusher,
} from './soc2-bootstrap';

describe('SOC2 evidence bootstrap', () => {
  afterEach(() => {
    stopSoc2EvidenceFlusher();
    vi.restoreAllMocks();
  });

  it('starts a singleton flusher without submitting immediately', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = {
      COMP_API_URL: 'http://comp.local',
      COMP_API_KEY: 'comp-key',
      SUPABASE_URL: 'https://supabase.local',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
      SOC2_COMP_BATCH_SIZE: '3',
      SOC2_COMP_FLUSH_INTERVAL_MS: '10000',
    };

    const first = startSoc2EvidenceFlusher(env);
    const second = startSoc2EvidenceFlusher(env);

    expect(second).toBe(first);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns but does not crash when optional runtime credentials are absent', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const flusher = startSoc2EvidenceFlusher({});

    expect(flusher).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(
      'COMP_API_KEY is unset; SOC2 evidence flusher started but Comp submissions will fail auth.',
    );
    expect(warnSpy).toHaveBeenCalledWith(
      'Supabase audit reader disabled; SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is unset.',
    );
  });
});
