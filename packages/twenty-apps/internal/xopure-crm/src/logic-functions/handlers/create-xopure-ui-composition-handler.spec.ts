import { beforeEach, describe, expect, it, vi } from 'vitest';

import { XOPURE_GENUI_CATALOG_VERSION } from '../../genui/xopure-ui-composition';
import { handleCreateXopureUiComposition } from './create-xopure-ui-composition-handler';

const { mutationMock } = vi.hoisted(() => ({
  mutationMock: vi.fn(),
}));

vi.mock('twenty-client-sdk/core', () => ({
  CoreApiClient: class {
    mutation = mutationMock;
  },
}));

const composition = () => ({
  schemaVersion: 1,
  catalogVersion: XOPURE_GENUI_CATALOG_VERSION,
  title: 'Revenue health',
  layout: { columns: 1, gap: 'normal' },
  blocks: [
    {
      id: 'paid-revenue',
      type: 'kpi',
      version: 1,
      label: 'Paid revenue',
      value: 12500,
    },
  ],
});

describe('handleCreateXopureUiComposition', () => {
  beforeEach(() => {
    mutationMock.mockReset();
  });

  it('validates, stamps provenance, persists, and returns a record reference', async () => {
    mutationMock.mockResolvedValue({
      createXopureUiComposition: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Revenue health',
      },
    });

    const result = await handleCreateXopureUiComposition({
      name: 'Revenue health',
      composition: composition(),
    });

    expect(result).toMatchObject({
      success: true,
      result: {
        compositionId: '00000000-0000-4000-8000-000000000001',
      },
      recordReferences: [
        {
          objectNameSingular: 'xopureUiComposition',
          recordId: '00000000-0000-4000-8000-000000000001',
        },
      ],
    });
    expect(mutationMock).toHaveBeenCalledWith({
      createXopureUiComposition: {
        __args: {
          data: expect.objectContaining({
            catalogVersion: XOPURE_GENUI_CATALOG_VERSION,
            name: 'Revenue health',
            schemaVersion: 1,
            sourceTool: 'app_xopure_create_ui_composition',
            status: 'READY',
            document: expect.objectContaining({
              provenance: expect.objectContaining({
                createdBy: 'app_xopure_create_ui_composition',
              }),
            }),
          }),
        },
        id: true,
        name: true,
      },
    });
  });

  it('fails closed without persisting invalid composition data', async () => {
    const result = await handleCreateXopureUiComposition({
      name: 'Unsafe',
      composition: {
        ...composition(),
        blocks: [],
        script: 'alert(1)',
      },
    });

    expect(result).toMatchObject({
      success: false,
      error: 'Composition validation failed.',
      result: {
        errors: expect.arrayContaining([
          '$.script is not allowed',
          '$.blocks must contain at least one block',
        ]),
      },
    });
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it('rejects missing names and non-object compositions before persistence', async () => {
    await expect(
      handleCreateXopureUiComposition({ name: ' ', composition: composition() }),
    ).resolves.toEqual({
      success: false,
      error: 'name must contain between 1 and 120 characters.',
    });
    await expect(
      handleCreateXopureUiComposition({ name: 'Invalid', composition: [] }),
    ).resolves.toEqual({
      success: false,
      error: 'composition must be a JSON object.',
    });
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it('normalizes persistence failures without exposing backend details', async () => {
    mutationMock.mockRejectedValue(new Error('database credential leaked here'));

    await expect(
      handleCreateXopureUiComposition({
        name: 'Revenue health',
        composition: composition(),
      }),
    ).resolves.toEqual({
      success: false,
      error: 'Twenty could not persist the composition. Try again.',
    });
  });

  it('rejects executable content in the persisted record name', async () => {
    await expect(
      handleCreateXopureUiComposition({
        name: '<script>alert(1)</script>',
        composition: composition(),
      }),
    ).resolves.toEqual({
      success: false,
      error: 'name contains executable markup, styling, or a URL.',
    });
    expect(mutationMock).not.toHaveBeenCalled();
  });
});
