import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';
import {
  XOPURE_MISSION_CONTROL_NAVIGATION_MENU_ITEM_NAME,
  XOPURE_MISSION_CONTROL_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
} from 'src/page-layouts/xopure-mission-control.page-layout';

export default defineNavigationMenuItem({
  universalIdentifier: '6cb16017-b8b0-4491-bbda-907a77f12889',
  name: XOPURE_MISSION_CONTROL_NAVIGATION_MENU_ITEM_NAME,
  icon: 'IconLayoutDashboard',
  position: 0,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier:
    XOPURE_MISSION_CONTROL_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
});
