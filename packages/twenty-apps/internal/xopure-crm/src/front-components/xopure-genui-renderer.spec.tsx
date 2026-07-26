import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { type XopureUiCompositionBlock } from '../genui/xopure-ui-composition';
import {
  ensureRecordCanOpen,
  renderXopureGenuiBlock,
  resolveXopureCompositionRecordId,
  type XopureGenUiPalette,
} from './xopure-genui-renderer';

const palette: XopureGenUiPalette = {
  accent: '#1d4ed8',
  background: '#f7f8fa',
  border: '#d9dee5',
  muted: '#5f6b7a',
  onAccent: '#ffffff',
  surface: '#ffffff',
  text: '#1b2430',
};

const targetId = '1858ba4c-2c5b-4f4c-a830-08a8add35ea1';

const representativeBlocks: XopureUiCompositionBlock[] = [
  { id: 'kpi', type: 'kpi', version: 1, label: 'Revenue', value: 42 },
  {
    id: 'chart',
    type: 'chart',
    version: 1,
    chartType: 'bar',
    points: [{ label: 'Paid', value: 4 }],
  },
  {
    id: 'table',
    type: 'table',
    version: 1,
    columns: [{ key: 'name', label: 'Name' }],
    rows: [{ name: 'Order A' }],
  },
  {
    id: 'timeline',
    type: 'timeline',
    version: 1,
    entries: [{ timestamp: '2026-07-26T00:00:00Z', title: 'Synced' }],
  },
  { id: 'alert', type: 'alert', version: 1, severity: 'warning', message: 'Review' },
  { id: 'markdown', type: 'markdown', version: 1, text: 'Plain text' },
  {
    id: 'action',
    type: 'action',
    version: 1,
    label: 'Open order',
    action: { id: 'open-record', objectNameSingular: 'xopureOrder', recordId: targetId },
  },
  {
    id: 'record-link',
    type: 'record-link',
    version: 1,
    label: 'Order A',
    objectNameSingular: 'xopureOrder',
    recordId: targetId,
  },
];

describe('XO Pure GenUI renderer contracts', () => {
  it('renders every catalog block through accessible Remote DOM primitives', () => {
    for (const block of representativeBlocks) {
      const markup = renderToStaticMarkup(
        <>{renderXopureGenuiBlock(block, palette, vi.fn())}</>,
      );
      expect(markup).toContain('<section');
      expect(markup).not.toContain('script');
      expect(markup).not.toContain('iframe');
    }
  });

  it('caps table rows at the renderer boundary', () => {
    const block: XopureUiCompositionBlock = {
      id: 'bounded-table',
      type: 'table',
      version: 1,
      columns: [{ key: 'name', label: 'Name' }],
      rows: Array.from({ length: 101 }, (_, index) => ({ name: `Row ${index}` })),
    };

    const markup = renderToStaticMarkup(
      <>{renderXopureGenuiBlock(block, palette, vi.fn())}</>,
    );
    expect(markup).toContain('Row 99');
    expect(markup).not.toContain('Row 100');
  });

  it('requires one selected record but preserves nested record context', () => {
    expect(
      resolveXopureCompositionRecordId({
        selectedRecordIds: [targetId],
        recordId: null,
      }),
    ).toBe(targetId);
    expect(
      resolveXopureCompositionRecordId({
        selectedRecordIds: [targetId, 'bd1542f8-8e8f-4dd9-bb02-6f42eef287ad'],
        recordId: targetId,
      }),
    ).toBeNull();
    expect(
      resolveXopureCompositionRecordId({
        selectedRecordIds: [],
        recordId: targetId,
      }),
    ).toBe(targetId);
  });

  it('preflights allowlisted record targets and blocks missing or denied records', async () => {
    const query = vi.fn().mockResolvedValue({
      xopureOrders: { edges: [{ node: { id: targetId } }] },
    });
    await expect(
      ensureRecordCanOpen('xopureOrder', targetId, { query }),
    ).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith({
      xopureOrders: {
        __args: { filter: { id: { eq: targetId } }, first: 1 },
        edges: { node: { id: true } },
      },
    });

    await expect(
      ensureRecordCanOpen('xopureOrder', targetId, {
        query: vi.fn().mockResolvedValue({ xopureOrders: { edges: [] } }),
      }),
    ).rejects.toThrow('Record target is unavailable.');
    await expect(
      ensureRecordCanOpen('xopureOrder', targetId, {
        query: vi.fn().mockRejectedValue(new Error('forbidden')),
      }),
    ).rejects.toThrow('forbidden');
  });
});
