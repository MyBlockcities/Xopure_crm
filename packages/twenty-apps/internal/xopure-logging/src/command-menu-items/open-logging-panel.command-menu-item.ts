import { defineCommandMenuItem } from 'twenty-sdk/define';

import {
  COMMAND_MENU_ITEM_ID,
  GRAFANA_PANEL_COMPONENT_ID,
} from 'src/constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: COMMAND_MENU_ITEM_ID,
  label: 'Open XO Logging Panel',
  icon: 'IconChartDots3',
  frontComponentUniversalIdentifier: GRAFANA_PANEL_COMPONENT_ID,
});
