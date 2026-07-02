import {
  scrubPayload,
  DEFAULT_MAX_DEPTH,
} from 'src/engine/core-modules/event-logs/ingest/event-payload-scrubber';

describe('scrubPayload', () => {
  describe('sensitive field redaction', () => {
    it('redacts top-level authorization field', () => {
      const result = scrubPayload({ authorization: 'Bearer abc123', name: 'test' });

      expect(result).toEqual({ authorization: '[REDACTED]', name: 'test' });
    });

    it('redacts top-level cookie field', () => {
      const result = scrubPayload({ cookie: 'session=abc123', name: 'test' });

      expect(result).toEqual({ cookie: '[REDACTED]', name: 'test' });
    });

    it('redacts top-level token field', () => {
      const result = scrubPayload({ token: 'eyJhbGci', name: 'test' });

      expect(result).toEqual({ token: '[REDACTED]', name: 'test' });
    });

    it('redacts top-level secret field', () => {
      const result = scrubPayload({ secret: 'super-secret-value' });

      expect(result).toEqual({ secret: '[REDACTED]' });
    });

    it('redacts top-level password field', () => {
      const result = scrubPayload({ password: 'hunter2', name: 'test' });

      expect(result).toEqual({ password: '[REDACTED]', name: 'test' });
    });

    it('redacts top-level apiKey field', () => {
      const result = scrubPayload({ apiKey: 'sk-1234567890abcdef' });

      expect(result).toEqual({ apiKey: '[REDACTED]' });
    });

    it('redacts top-level email field', () => {
      const result = scrubPayload({ email: 'user@example.com', name: 'test' });

      expect(result).toEqual({ email: '[REDACTED]', name: 'test' });
    });

    it('redacts all seven sensitive field kinds in one payload', () => {
      const payload = {
        authorization: 'Bearer x',
        cookie: 'y',
        token: 'z',
        secret: 's',
        password: 'p',
        apiKey: 'k',
        email: 'a@b.com',
        safeField: 'keep',
      };

      const result = scrubPayload(payload);

      expect(result).toEqual({
        authorization: '[REDACTED]',
        cookie: '[REDACTED]',
        token: '[REDACTED]',
        secret: '[REDACTED]',
        password: '[REDACTED]',
        apiKey: '[REDACTED]',
        email: '[REDACTED]',
        safeField: 'keep',
      });
    });
  });

  describe('nested redaction', () => {
    it('redacts sensitive fields nested one level deep', () => {
      const payload = { user: { email: 'u@example.com', name: 'Alice' } };

      const result = scrubPayload(payload);

      expect(result).toEqual({ user: { email: '[REDACTED]', name: 'Alice' } });
    });

    it('redacts sensitive fields nested two levels deep', () => {
      const payload = {
        request: {
          headers: { authorization: 'Bearer x', contentType: 'application/json' },
        },
      };

      const result = scrubPayload(payload);

      expect(result).toEqual({
        request: {
          headers: { authorization: '[REDACTED]', contentType: 'application/json' },
        },
      });
    });

    it('redacts sensitive fields nested inside arrays', () => {
      const payload = {
        events: [
          { email: 'a@b.com' },
          { email: 'c@d.com', name: 'test' },
        ],
      };

      const result = scrubPayload(payload);

      expect(result).toEqual({
        events: [
          { email: '[REDACTED]' },
          { email: '[REDACTED]', name: 'test' },
        ],
      });
    });

    it('handles arrays of primitives by passing them through', () => {
      const result = scrubPayload({ tags: ['a', 'b', 'c'] });

      expect(result).toEqual({ tags: ['a', 'b', 'c'] });
    });
  });

  describe('case insensitivity', () => {
    it.each(['Authorization', 'AUTHORIZATION', 'authorization'])(
      'redacts %s (authorization-like) regardless of case',
      (key) => {
      const result = scrubPayload({ [key]: 'Bearer x', safe: 'y' });

      expect(result).toEqual({ [key]: '[REDACTED]', safe: 'y' });
    });

    it.each(['Password', 'PASSWORD', 'password'])(
      'redacts %s (credential-like) regardless of case',
      (key) => {
      const result = scrubPayload({ [key]: 'hunter2', safe: 'y' });

      expect(result).toEqual({ [key]: '[REDACTED]', safe: 'y' });
    });
  });

  describe('safe fields preservation', () => {
    it('preserves fields not matching sensitive patterns', () => {
      const payload = {
        name: 'test',
        description: 'some description',
        count: 42,
        isActive: true,
        nested: { value: 'deep' },
      };

      const result = scrubPayload(payload);

      expect(result).toEqual(payload);
    });

    it('preserves safe fields alongside redacted fields', () => {
      const payload = {
        name: 'test',
        password: 'secret',
        description: 'desc',
        authorization: 'Bearer x',
      };

      const result = scrubPayload(payload);

      expect(result).toEqual({
        name: 'test',
        password: '[REDACTED]',
        description: 'desc',
        authorization: '[REDACTED]',
      });
    });
  });

  describe('depth limiting', () => {
    it('replaces oversized depth with a redaction marker', () => {
      const deep = { a: { b: { c: { d: 'too deep' } } } };

      const result = scrubPayload(deep, 2);

      expect(result).toEqual({ a: { b: '[REDACTED]' } });
    });

    it('uses DEFAULT_MAX_DEPTH when no maxDepth is provided', () => {
      expect(DEFAULT_MAX_DEPTH).toBeGreaterThanOrEqual(10);
    });

    it('depth limit of 0 redacts the entire payload', () => {
      const result = scrubPayload({ a: { b: 'c' } }, 0);

      expect(result).toEqual('[REDACTED]');
    });

    it('depth limit of 1 preserves only top-level keys', () => {
      const payload = {
        name: 'test',
        email: 'a@b.com',
        nested: { inner: 'value' },
      };

      const result = scrubPayload(payload, 1);

      expect(result).toEqual({
        name: 'test',
        email: '[REDACTED]',
        nested: '[REDACTED]',
      });
    });

    it('counts depth from root object, not array primitives', () => {
      const payload = { items: [{ email: 'a@b.com' }] };

      const result = scrubPayload(payload, 2);

      expect(result).toEqual({ items: [{ email: '[REDACTED]' }] });
    });
  });

  describe('edge cases', () => {
    it('does not mutate the original object', () => {
      const original = {
        password: 'secret',
        nested: { token: 'abc', name: 'safe' },
      };
      const copy = JSON.parse(JSON.stringify(original));

      scrubPayload(original);

      expect(original).toEqual(copy);
    });

    it('handles null payload', () => {
      expect(scrubPayload(null)).toBeNull();
    });

    it('handles undefined payload', () => {
      expect(scrubPayload(undefined)).toBeUndefined();
    });

    it('handles string payload', () => {
      expect(scrubPayload('hello')).toBe('hello');
    });

    it('handles number payload', () => {
      expect(scrubPayload(42)).toBe(42);
    });

    it('handles boolean payload', () => {
      expect(scrubPayload(true)).toBe(true);
    });

    it('handles empty object', () => {
      expect(scrubPayload({})).toEqual({});
    });

    it('handles empty array', () => {
      expect(scrubPayload([])).toEqual([]);
    });

    it('handles null values inside objects', () => {
      const result = scrubPayload({ name: null, email: 'a@b.com' });

      expect(result).toEqual({ name: null, email: '[REDACTED]' });
    });

    it('handles undefined values inside objects', () => {
      const result = scrubPayload({ name: undefined, authorization: 'x' });

      expect(result).toEqual({ name: undefined, authorization: '[REDACTED]' });
    });
  });
});
