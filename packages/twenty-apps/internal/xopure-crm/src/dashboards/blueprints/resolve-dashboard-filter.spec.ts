import { describe, expect, it } from 'vitest';
import { resolveDashboardFilter } from './resolve-dashboard-filter';

const mockMetadata = {
  fieldsByName: {
    lastStatus: { id: 'uuid-lastStatus', name: 'lastStatus' },
    syncKey: { id: 'uuid-syncKey', name: 'syncKey' },
    sourceTable: { id: 'uuid-sourceTable', name: 'sourceTable' },
  },
};

describe('resolveDashboardFilter', () => {
  it('resolves top-level field-name keys to metadata IDs', () => {
    const result = resolveDashboardFilter(mockMetadata, {
      lastStatus: { in: ['FAILED_RETRYABLE', 'FAILED_PERMANENT'] },
    });

    expect(result).toEqual({
      'uuid-lastStatus': { in: ['FAILED_RETRYABLE', 'FAILED_PERMANENT'] },
    });
  });

  it('resolves multiple field-name keys in one filter', () => {
    const result = resolveDashboardFilter(mockMetadata, {
      lastStatus: { eq: 'FAILED_RETRYABLE' },
      syncKey: { in: ['a', 'b'] },
    });

    expect(result).toEqual({
      'uuid-lastStatus': { eq: 'FAILED_RETRYABLE' },
      'uuid-syncKey': { in: ['a', 'b'] },
    });
  });

  it('preserves operator and value structure untouched', () => {
    const result = resolveDashboardFilter(mockMetadata, {
      sourceTable: { eq: 'payments' },
    });

    expect(result).toEqual({
      'uuid-sourceTable': { eq: 'payments' },
    });
  });

  it('returns undefined when filter is undefined', () => {
    expect(resolveDashboardFilter(mockMetadata, undefined)).toBeUndefined();
  });

  it('returns the value as-is when filter is null', () => {
    expect(resolveDashboardFilter(mockMetadata, null)).toBeNull();
  });

  it('throws on unknown field name', () => {
    expect(() =>
      resolveDashboardFilter(mockMetadata, {
        nonExistentField: { eq: 'value' },
      }),
    ).toThrow('nonExistentField');
  });
});
