import { describe, expect, it } from 'vitest';

import {
  XOPURE_GENUI_CATALOG_VERSION,
  XOPURE_GENUI_LEGACY_CATALOG_VERSION,
  XOPURE_GENUI_LIMITS,
  XOPURE_GENUI_PREVIOUS_CATALOG_VERSION,
  XOPURE_GENUI_TEMPLATE_CATALOG,
  XOPURE_GENUI_TOOL_COMPOSITION_INPUT_SCHEMA,
  migrateXopureUiComposition,
  validateXopureUiComposition,
} from './xopure-ui-composition';

const validComposition = () => ({
  schemaVersion: 1,
  catalogVersion: XOPURE_GENUI_CATALOG_VERSION,
  title: 'XO Pure Operations',
  layout: { columns: 2, gap: 'normal' },
  provenance: {
    createdBy: 'app_xopure_create_composition',
    createdAt: '2026-07-26T12:00:00Z',
  },
  blocks: [
    { id: 'revenue', type: 'kpi', version: 1, label: 'Paid revenue', value: 12500, detail: 'USD cents' },
    { id: 'orders', type: 'chart', version: 1, chartType: 'bar', points: [{ label: 'Paid', value: 12 }] },
    {
      id: 'exceptions',
      type: 'table',
      version: 1,
      columns: [{ key: 'status', label: 'Status' }],
      rows: [{ status: 'HELD' }],
    },
    {
      id: 'events',
      type: 'timeline',
      version: 1,
      entries: [{ timestamp: '2026-07-26T12:00:00Z', title: 'Composition created' }],
    },
    { id: 'warning', type: 'alert', version: 1, severity: 'warning', message: 'Review held commissions.' },
    { id: 'notes', type: 'markdown', version: 1, text: '**Rendered as plain text.**' },
    {
      id: 'open-order',
      type: 'action',
      version: 1,
      label: 'Open order',
      action: {
        id: 'open-record',
        recordId: '00000000-0000-4000-8000-000000000001',
        objectNameSingular: 'xopureOrder',
      },
    },
    {
      id: 'order-link',
      type: 'record-link',
      version: 1,
      label: 'Order record',
      recordId: '00000000-0000-4000-8000-000000000001',
      objectNameSingular: 'xopureOrder',
    },
  ],
});

describe('validateXopureUiComposition', () => {
  it('accepts every catalog block type and returns canonical data', () => {
    const result = validateXopureUiComposition(validComposition());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.blocks.map(({ type }) => type)).toEqual([
      'kpi',
      'chart',
      'table',
      'timeline',
      'alert',
      'markdown',
      'action',
      'record-link',
    ]);
  });

  it('rejects empty and duplicate block collections', () => {
    const empty = validComposition();
    empty.blocks = [];
    const duplicate = validComposition();
    duplicate.blocks[1] = { ...duplicate.blocks[0] };

    expect(validateXopureUiComposition(empty)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['$.blocks must contain at least one block']),
    });
    expect(validateXopureUiComposition(duplicate)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['$.blocks[1].id must be unique']),
    });
  });

  it('rejects unknown executable properties instead of retaining them', () => {
    const base = validComposition();
    const input = {
      ...base,
      blocks: base.blocks.map((block, index) =>
        index === 0 ? { ...block, dangerouslySetInnerHTML: '<script />' } : block),
      script: 'alert(1)',
    };

    const result = validateXopureUiComposition(input);

    expect(result).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        '$.script is not allowed',
        '$.blocks[0].dangerouslySetInnerHTML is not allowed',
      ]),
    });
  });

  it.each(['/settings/ai', '/developers/api-keys', '//attacker.example']) (
    'rejects non-allowlisted navigation path %s',
    (path) => {
      const input = validComposition();
      input.blocks = [{
        id: 'navigate',
        type: 'action',
        version: 1,
        label: 'Navigate',
        action: { id: 'navigate-internal', path },
      }];

      expect(validateXopureUiComposition(input)).toMatchObject({
        ok: false,
        errors: expect.arrayContaining(['$.blocks[0].action.path must be a safe internal path']),
      });
    },
  );

  it('accepts only supported object-index, record, and page navigation routes', () => {
    const paths = [
      '/',
      '/objects/xopureOrders',
      '/object/xopureOrder/00000000-0000-4000-8000-000000000001',
      '/page/00000000-0000-4000-8000-000000000002',
    ];

    for (const path of paths) {
      const input = validComposition();
      input.blocks = [{ id: 'navigate', type: 'action', version: 1, label: 'Navigate', action: { id: 'navigate-internal', path } }];
      expect(validateXopureUiComposition(input)).toMatchObject({ ok: true });
    }
  });

  it('rejects malformed object names and oversized documents', () => {
    const invalidObject = validComposition();
    invalidObject.blocks[6] = {
      ...invalidObject.blocks[6],
      action: {
        id: 'open-record',
        recordId: '00000000-0000-4000-8000-000000000001',
        objectNameSingular: '../settings',
      },
    };
    const oversized = validComposition();
    oversized.blocks = [{ id: 'notes', type: 'markdown', version: 1, text: 'x'.repeat(70_000) }];

    expect(validateXopureUiComposition(invalidObject)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        '$.blocks[6].action.objectNameSingular is not an allowlisted record target',
      ]),
    });
    expect(validateXopureUiComposition(oversized)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['$ exceeds maximum document size of 65536 bytes']),
    });
  });

  it('publishes strict template schemas, capabilities, design tokens, and limits', () => {
    expect(XOPURE_GENUI_TEMPLATE_CATALOG).toMatchObject({
      dataSource: 'inline-only',
      designTokens: {
        columns: [1, 2, 3],
        gapPixels: { compact: 8, normal: 16, relaxed: 24 },
      },
      limits: XOPURE_GENUI_LIMITS,
    });
    for (const { inputSchema } of Object.values(
      XOPURE_GENUI_TEMPLATE_CATALOG.blockTypes,
    )) {
      expect(inputSchema).toMatchObject({
        type: 'object',
        properties: expect.any(Object),
        required: expect.any(Array),
        additionalProperties: false,
      });
      expect(inputSchema).not.toHaveProperty('optional');
    }
    expect(XOPURE_GENUI_TOOL_COMPOSITION_INPUT_SCHEMA).toMatchObject({
      type: 'object',
      properties: {
        blocks: {
          type: 'array',
          minItems: 1,
          maxItems: XOPURE_GENUI_LIMITS.maxBlocks,
          items: { oneOf: expect.any(Array) },
        },
        layout: {
          additionalProperties: false,
          properties: {
            columns: { minimum: 1, maximum: 3 },
          },
        },
      },
      additionalProperties: false,
    });
    expect(XOPURE_GENUI_TEMPLATE_CATALOG.blockTypes.action.capabilities).toEqual([
      'open-composition-panel',
      'open-record-panel',
      'navigate-internal',
    ]);
  });

  it.each([
    '<script>alert(1)</script>',
    '<Dashboard revenue={revenue} />',
    '.dashboard { color: red; }',
    'https://attacker.example/payload',
    'const payload = () => window.localStorage',
  ])('rejects executable markup, styling, and URLs inside allowed text fields', (text) => {
    const input = validComposition();
    input.blocks[5] = { id: 'notes', type: 'markdown', version: 1, text };

    expect(validateXopureUiComposition(input)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        '$.blocks[5].text contains executable markup, styling, or a URL',
      ]),
    });
  });

  it('rejects unknown versions, templates, actions, capabilities, and query declarations', () => {
    const unknownVersion = { ...validComposition(), schemaVersion: 2 };
    const unknownTemplate = {
      ...validComposition(),
      blocks: [{ id: 'custom', type: 'iframe', version: 1 }],
    };
    const unknownAction = {
      ...validComposition(),
      blocks: [{
        id: 'run',
        type: 'action',
        version: 1,
        label: 'Run',
        action: { id: 'execute-javascript', source: 'alert(1)' },
      }],
    };
    const supportedNestedAction = {
      ...validComposition(),
      blocks: [{
        id: 'nested',
        type: 'action',
        version: 1,
        label: 'Open child',
        action: {
          id: 'open-composition',
          compositionId: '1858ba4c-2c5b-4f4c-a830-08a8add35ea1',
        },
      }],
    };
    const undeclaredCapability = {
      ...validComposition(),
      capabilities: ['network'],
      query: { object: 'xopureOrder' },
    };

    expect(validateXopureUiComposition(unknownVersion)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['$.schemaVersion is not supported']),
    });
    expect(validateXopureUiComposition(unknownTemplate)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['$.blocks[0].type is not supported']),
    });
    expect(validateXopureUiComposition(unknownAction)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['$.blocks[0].action.id is not allowlisted']),
    });
    expect(validateXopureUiComposition(supportedNestedAction)).toMatchObject({
      ok: true,
      value: {
        blocks: [
          expect.objectContaining({
            action: {
              id: 'open-composition',
              compositionId: '1858ba4c-2c5b-4f4c-a830-08a8add35ea1',
            },
          }),
        ],
      },
    });
    expect(validateXopureUiComposition(undeclaredCapability)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        '$.capabilities is not allowed',
        '$.query is not allowed',
      ]),
    });
  });

  it('enforces every catalog data-volume limit before returning canonical data', () => {
    const tooManyBlocks = {
      ...validComposition(),
      blocks: Array.from(
        { length: XOPURE_GENUI_LIMITS.maxBlocks + 1 },
        (_, index) => ({
          id: `kpi-${index}`,
          type: 'kpi',
          version: 1,
          label: `KPI ${index}`,
          value: index,
        }),
      ),
    };
    const tooManyPoints = {
      ...validComposition(),
      blocks: [{
        id: 'chart',
        type: 'chart',
        version: 1,
        chartType: 'bar',
        points: Array.from(
          { length: XOPURE_GENUI_LIMITS.maxChartPoints + 1 },
          (_, index) => ({ label: `Point ${index}`, value: index }),
        ),
      }],
    };
    const tooManyColumns = {
      ...validComposition(),
      blocks: [{
        id: 'table',
        type: 'table',
        version: 1,
        columns: Array.from(
          { length: XOPURE_GENUI_LIMITS.maxTableColumns + 1 },
          (_, index) => ({ key: `column${index}`, label: `Column ${index}` }),
        ),
        rows: [],
      }],
    };
    const tooManyRows = {
      ...validComposition(),
      blocks: [{
        id: 'table',
        type: 'table',
        version: 1,
        columns: [{ key: 'value', label: 'Value' }],
        rows: Array.from(
          { length: XOPURE_GENUI_LIMITS.maxTableRows + 1 },
          (_, index) => ({ value: index }),
        ),
      }],
    };
    const tooManyEntries = {
      ...validComposition(),
      blocks: [{
        id: 'timeline',
        type: 'timeline',
        version: 1,
        entries: Array.from(
          { length: XOPURE_GENUI_LIMITS.maxTimelineEntries + 1 },
          (_, index) => ({
            timestamp: '2026-07-26T12:00:00Z',
            title: `Event ${index}`,
          }),
        ),
      }],
    };

    expect(validateXopureUiComposition(tooManyBlocks)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['$.blocks exceeds maximum of 40 blocks']),
    });
    expect(validateXopureUiComposition(tooManyPoints)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['$.blocks[0].points exceeds maximum of 100 points']),
    });
    expect(validateXopureUiComposition(tooManyColumns)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['$.blocks[0].columns exceeds maximum of 12 columns']),
    });
    expect(validateXopureUiComposition(tooManyRows)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['$.blocks[0].rows exceeds maximum of 100 rows']),
    });
    expect(validateXopureUiComposition(tooManyEntries)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['$.blocks[0].entries exceeds maximum of 100 entries']),
    });
  });

  it('enforces persisted-document string bounds from the published schemas', () => {
    const oversizedMarkdown = validComposition();
    oversizedMarkdown.blocks[5] = {
      id: 'notes',
      type: 'markdown',
      version: 1,
      text: 'm'.repeat(16_385),
    };

    const oversizedId = validComposition();
    oversizedId.blocks[0] = {
      id: 'i'.repeat(129),
      type: 'kpi',
      version: 1,
      label: 'Revenue',
      value: 42,
    };

    const oversizedCell = validComposition();
    oversizedCell.blocks[2] = {
      id: 'table',
      type: 'table',
      version: 1,
      columns: [{ key: 'name', label: 'Name' }],
      rows: [{ name: 'c'.repeat(4097) }],
    };

    const oversizedDetail = validComposition();
    oversizedDetail.blocks[0] = {
      id: 'kpi',
      type: 'kpi',
      version: 1,
      label: 'Revenue',
      value: 42,
      detail: 'd'.repeat(4097),
    };

    const oversizedTimestamp = validComposition();
    oversizedTimestamp.blocks[3] = {
      id: 'timeline',
      type: 'timeline',
      version: 1,
      entries: [{
        timestamp: `2026-07-26T00:00:00.${'1'.repeat(50)}Z`,
        title: 'Synced',
      }],
    };

    expect(validateXopureUiComposition(oversizedMarkdown)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        '$.blocks[5].text must be at most 16384 characters',
      ]),
    });
    expect(validateXopureUiComposition(oversizedId)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        '$.blocks[0].id must be at most 128 characters',
      ]),
    });
    expect(validateXopureUiComposition(oversizedCell)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        '$.blocks[2].rows[0].name must be at most 4096 characters',
      ]),
    });
    expect(validateXopureUiComposition(oversizedDetail)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        '$.blocks[0].detail must be at most 4096 characters',
      ]),
    });
    expect(validateXopureUiComposition(oversizedTimestamp)).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        '$.blocks[3].entries[0].timestamp must be at most 64 characters',
      ]),
    });
  });

  it('migrates the supported predecessor deterministically without changing rendered blocks', () => {
    const current = validComposition();
    const previous = {
      ...current,
      catalogVersion: XOPURE_GENUI_PREVIOUS_CATALOG_VERSION,
    };

    const first = migrateXopureUiComposition(previous);
    const second = migrateXopureUiComposition(previous);
    const currentValidation = validateXopureUiComposition(current);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      migrated: true,
      fromCatalogVersion: XOPURE_GENUI_PREVIOUS_CATALOG_VERSION,
    });
    expect(currentValidation.ok).toBe(true);
    if (!first.ok || !currentValidation.ok) return;
    expect(first.value.blocks).toEqual(currentValidation.value.blocks);
    expect(first.value).toEqual({
      ...currentValidation.value,
      catalogVersion: XOPURE_GENUI_CATALOG_VERSION,
    });
  });

  it('keeps the original dated catalog migratable after the nested-panel catalog upgrade', () => {
    const legacy = {
      ...validComposition(),
      catalogVersion: XOPURE_GENUI_LEGACY_CATALOG_VERSION,
    };

    expect(migrateXopureUiComposition(legacy)).toMatchObject({
      ok: true,
      migrated: true,
      fromCatalogVersion: XOPURE_GENUI_LEGACY_CATALOG_VERSION,
      value: { catalogVersion: XOPURE_GENUI_CATALOG_VERSION },
    });
  });
});
