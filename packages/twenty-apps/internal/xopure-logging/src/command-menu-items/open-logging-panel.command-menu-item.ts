import { defineCommandMenuItem } from 'twenty-sdk/define';
import { COMMAND_MENU_ITEM_ID, GRAFANA_PANEL_COMPONENT_ID } from '../constants/universal-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: COMMAND_MENU_ITEM_ID,
  label: 'Open Logging Panel',
  icon: 'IconSearch',
  isPinned: false,
  frontComponentUniversalIdentifier: GRAFANA_PANEL_COMPONENT_ID,
});
