import { CoreApiClient } from 'twenty-client-sdk/core';

import {
  isSafeXopureGenUiText,
  migrateXopureUiComposition,
} from '../../genui/xopure-ui-composition';

type CreateCompositionInput = {
  name: string;
  composition: unknown;
};

type CreatedComposition = {
  id: string;
  name: string;
};

type CoreClient = {
  mutation: (input: Record<string, unknown>) => Promise<{
    createXopureUiComposition?: CreatedComposition;
  }>;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const handleCreateXopureUiComposition = async (input: CreateCompositionInput) => {
  if (!isPlainObject(input)) {
    return { success: false, error: 'Input must be a JSON object.' };
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length === 0 || name.length > 120) {
    return { success: false, error: 'name must contain between 1 and 120 characters.' };
  }
  if (!isSafeXopureGenUiText(name)) {
    return {
      success: false,
      error: 'name contains executable markup, styling, or a URL.',
    };
  }
  if (!isPlainObject(input.composition)) {
    return { success: false, error: 'composition must be a JSON object.' };
  }

  const validation = migrateXopureUiComposition({
    ...input.composition,
    provenance: {
      createdAt: new Date().toISOString(),
      createdBy: 'app_xopure_create_ui_composition',
    },
  });

  if (!validation.ok) {
    return {
      success: false,
      error: 'Composition validation failed.',
      result: { errors: validation.errors.slice(0, 20) },
    };
  }

  const client = new CoreApiClient() as unknown as CoreClient;
  let createXopureUiComposition: CreatedComposition | undefined;
  try {
    ({ createXopureUiComposition } = await client.mutation({
      createXopureUiComposition: {
        __args: {
          data: {
            catalogVersion: validation.value.catalogVersion,
            document: validation.value,
            name,
            schemaVersion: validation.value.schemaVersion,
            sourceTool: 'app_xopure_create_ui_composition',
            status: 'READY',
          },
        },
        id: true,
        name: true,
      },
    }));
  } catch {
    return {
      success: false,
      error: 'Twenty could not persist the composition. Try again.',
    };
  }

  if (!createXopureUiComposition?.id) {
    return { success: false, error: 'Twenty did not return the created composition.' };
  }

  return {
    success: true,
    message: `Created XO Pure composition “${createXopureUiComposition.name}”.`,
    result: {
      compositionId: createXopureUiComposition.id,
      rendererFrontComponentId: '1c9a1e56-8d5c-4c59-a27d-1bbd585ff601',
    },
    recordReferences: [
      {
        displayName: createXopureUiComposition.name,
        objectNameSingular: 'xopureUiComposition',
        recordId: createXopureUiComposition.id,
      },
    ],
  };
};
