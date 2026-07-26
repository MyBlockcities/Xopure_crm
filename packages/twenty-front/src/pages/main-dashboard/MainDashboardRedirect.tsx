import { useEffect } from 'react';

import { navigationMenuItemsSelector } from '@/navigation-menu-item/common/states/navigationMenuItemsSelector';
import { metadataStoreState } from '@/metadata-store/states/metadataStoreState';
import { useAtomFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilyStateValue';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { AppPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { Loader } from 'twenty-ui/feedback';
import { useNavigateApp } from '~/hooks/useNavigateApp';

const XOPURE_MISSION_CONTROL_NAVIGATION_MENU_ITEM_NAME =
  'XO Pure Mission Control';

/**
 * MainDashboardRedirect
 *
 * The XO Pure app owns the primary Mission Control page layout. When the app is
 * installed, its navigation item contains the workspace-specific page layout id
 * needed by the standalone page route. If the app is not installed yet, fall
 * back to the Dashboards object where the legacy template gallery is available.
 */
export const MainDashboardRedirect = () => {
  const navigateApp = useNavigateApp();
  const navigationMenuItems = useAtomStateValue(navigationMenuItemsSelector);
  const metadataStore = useAtomFamilyStateValue(
    metadataStoreState,
    'navigationMenuItems',
  );

  useEffect(() => {
    if (metadataStore.status === 'empty') {
      return;
    }

    const missionControlNavigationItem = navigationMenuItems.find(
      (item) =>
        item.name === XOPURE_MISSION_CONTROL_NAVIGATION_MENU_ITEM_NAME &&
        isDefined(item.pageLayoutId),
    );

    if (isDefined(missionControlNavigationItem?.pageLayoutId)) {
      navigateApp(AppPath.PageLayoutPage, {
        pageLayoutId: missionControlNavigationItem.pageLayoutId,
      });

      return;
    }

    navigateApp(AppPath.RecordIndexPage, {
      objectNamePlural: 'dashboards',
    });
  }, [metadataStore.status, navigateApp, navigationMenuItems]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
      }}
    >
      <Loader />
    </div>
  );
};
