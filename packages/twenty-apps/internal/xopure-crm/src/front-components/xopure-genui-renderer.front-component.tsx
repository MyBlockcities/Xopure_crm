import { defineFrontComponent } from 'twenty-sdk/define';

import {
  XOPURE_GENUI_RENDERER_FRONT_COMPONENT_ID,
  XopureGenuiRenderer,
} from './xopure-genui-renderer';

export default defineFrontComponent({
  component: XopureGenuiRenderer,
  description: 'Renders validated XO Pure composable GenUI compositions.',
  name: 'xopure-genui-renderer',
  universalIdentifier: XOPURE_GENUI_RENDERER_FRONT_COMPONENT_ID,
});
