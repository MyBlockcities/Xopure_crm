import { useEffect } from 'react';

import { AppPath } from 'twenty-shared/types';
import { useNavigateApp } from '~/hooks/useNavigateApp';

/**
 * MainDashboardRedirect (Apollo temporarily disabled)
 *
 * For now we land users on the Dashboards object index page.
 * This page already contains the prominent "Create Main Mission Control"
 * and "All templates" buttons we built, plus the full gallery.
 *
 * Root path has zero direct Apollo usage.
 * The template instantiation hook (useInstantiateDashboardTemplate) also has
 * its direct frontComponents Apollo query stripped for now — live realtime
 * widgets will be skipped until re-enabled.
 *
 * Once the custom object + FrontComponent metadata + Supabase sync are solid,
 * we can restore the full auto-instantiate + direct-to-dashboard behavior.
 */
export const MainDashboardRedirect = () => {
  const navigateApp = useNavigateApp();

  useEffect(() => {
    // Immediately send the user to the Dashboards list.
    // All the nice "Create Main Mission Control" UX lives there.
    navigateApp(AppPath.RecordIndexPage, {
      objectNamePlural: 'dashboards',
    });
  }, [navigateApp]);

  // Show a minimal loading state while the redirect happens
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '14px',
        color: '#666',
      }}
    >
      Redirecting to Dashboards...
    </div>
  );
};
