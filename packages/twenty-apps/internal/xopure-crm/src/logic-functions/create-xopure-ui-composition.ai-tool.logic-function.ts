import { defineLogicFunction } from 'twenty-sdk/define';

import { handleCreateXopureUiComposition } from './handlers/create-xopure-ui-composition-handler';
import {
  XOPURE_GENUI_TOOL_COMPOSITION_INPUT_SCHEMA,
  type XopureGenUiJsonSchema,
} from '../genui/xopure-ui-composition';

const toolInputSchema: XopureGenUiJsonSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Human-readable composition name.',
      minLength: 1,
      maxLength: 120,
    },
    composition: XOPURE_GENUI_TOOL_COMPOSITION_INPUT_SCHEMA,
  },
  required: ['name', 'composition'],
  additionalProperties: false,
};

export const XOPURE_CREATE_UI_COMPOSITION_FUNCTION_ID =
  'b6fc7f77-5f84-49e9-9062-8ad8116f4248';

export default defineLogicFunction({
  universalIdentifier: XOPURE_CREATE_UI_COMPOSITION_FUNCTION_ID,
  name: 'xopure-create-ui-composition',
  description:
    'Validate and persist a governed XO Pure composition for the Remote DOM side-panel renderer.',
  timeoutSeconds: 30,
  handler: handleCreateXopureUiComposition,
  toolTriggerSettings: {
    inputSchema: toolInputSchema,
  },
});
