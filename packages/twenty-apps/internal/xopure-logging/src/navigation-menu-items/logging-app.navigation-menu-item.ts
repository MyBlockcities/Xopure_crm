import { defineNavigationMenuItem } from 'twenty-sdk/define';
import { NavigationMenuItemType } from 'twenty-sdk/define';
import { NAVIGATION_MENU_ITEM_ID } from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: NAVIGATION_MENU_ITEM_ID,
  type: NavigationMenuItemType.LINK,
  name: 'XO Pure Logging',
  icon: 'IconSearch',
  position: 1,
  link: '/objects/xopure-logging/grafana',
});
