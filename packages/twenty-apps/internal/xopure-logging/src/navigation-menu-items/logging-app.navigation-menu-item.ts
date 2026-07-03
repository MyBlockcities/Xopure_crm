import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import { NAVIGATION_MENU_ITEM_ID } from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: NAVIGATION_MENU_ITEM_ID,
  name: 'xopure-grafana-logging',
  icon: 'IconChartDots3',
  position: 90,
  type: NavigationMenuItemType.LINK,
  link: 'https://hetz.cyprus-ling.ts.net:3333/grafana',
});
