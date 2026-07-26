import { defineCommandMenuItem } from 'twenty-sdk/define';

import { XOPURE_GENUI_RENDERER_FRONT_COMPONENT_ID } from '../front-components/xopure-genui-renderer';
import { XOPURE_UI_COMPOSITION_OBJECT_ID } from '../objects/xopure-ui-composition.object';

export const XOPURE_OPEN_UI_COMPOSITION_COMMAND_ID =
  '7b23d466-d015-4c75-be75-346707e7bd0c';

export default defineCommandMenuItem({
  universalIdentifier: XOPURE_OPEN_UI_COMPOSITION_COMMAND_ID,
  label: 'Open XO Pure composition',
  shortLabel: 'Open composition',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: XOPURE_UI_COMPOSITION_OBJECT_ID,
  frontComponentUniversalIdentifier:
    XOPURE_GENUI_RENDERER_FRONT_COMPONENT_ID,
});
