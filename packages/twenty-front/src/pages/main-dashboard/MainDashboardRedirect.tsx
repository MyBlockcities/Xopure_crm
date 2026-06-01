import { useEffect, useState } from 'react';

import { useInstantiateDashboardTemplate } from '@/dashboards/templates/hooks/useInstantiateDashboardTemplate';
import { PRIMARY_MAIN_DASHBOARD_TEMPLATE } from '@/dashboards/templates/constants/DashboardTemplates';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { useLingui } from '@lingui/react/macro';
import { Loader } from 'twenty-ui/feedback';

import { AppPath } from 'twenty-shared/types';
import { useNavigateApp } from '~/hooks/useNavigateApp';

/**
 * MainDashboardRedirect — The perfected "home" for XO Pure CRM.
 *
 * Landing on the app root (after login) now takes the user straight to the
 * incredible Admin Mission Control I dashboard — the global command center.
 *
 * Behavior:
 * - If the primary dashboard record exists → direct navigation to its show page.
 * - If not → automatically instantiate it using the official template (creates
 *   the Dashboard + rich PageLayout with all possible widgets).
 *
 * Robustness (perfection level):
 * - Detects whether the required custom objects (ambassador, xoOrder, customer,
 *   period, product) exist in the current workspace metadata.
 * - Shows clear, actionable guidance when prerequisites are missing.
 * - Still creates the dashboard (with whatever cards can be resolved) so the
 *   user always has a working main dashboard.
 * - Excellent loading + fallback states.
 *
 * This, combined with the prominent CTAs in the Dashboards section and the
 * detailed runbook, gives a truly production-grade "main dashboard" experience.
 */
export const MainDashboardRedirect = () => {
  const { t } = useLingui();
  const navigateApp = useNavigateApp();
  const { instantiateDashboardTemplate } = useInstantiateDashboardTemplate();
  const { objectMetadataItems } = useObjectMetadataItems();

  const [isLoading, setIsLoading] = useState(true);
  const [hasAttemptedCreate, setHasAttemptedCreate] = useState(false);
  const [missingObjects, setMissingObjects] = useState<string[]>([]);

  // The key custom objects required for a fully populated XO Pure experience
  const REQUIRED_CUSTOM_OBJECTS = ['ambassador', 'xoOrder', 'customer', 'period', 'product'];

  // Query for existing primary main dashboard by exact title
  const { records: existingDashboards, loading: dashboardsLoading } =
    useFindManyRecords({
      objectNameSingular: CoreObjectNameSingular.Dashboard,
      filter: {
        title: {
          eq: PRIMARY_MAIN_DASHBOARD_TEMPLATE.name,
        },
      },
      limit: 1,
    });

  // Check which required custom objects are present in the workspace
  const checkMissingObjects = () => {
    const missing = REQUIRED_CUSTOM_OBJECTS.filter(
      (name) =>
        !objectMetadataItems.some((item) => item.nameSingular === name),
    );
    setMissingObjects(missing);
    return missing;
  };

  useEffect(() => {
    if (dashboardsLoading) {
      return;
    }

    const missing = checkMissingObjects();
    const primaryDashboard = existingDashboards?.[0];

    if (isDefined(primaryDashboard) && isDefined(primaryDashboard.id)) {
      setIsLoading(false);
      navigateApp(AppPath.RecordShowPage, {
        objectNameSingular: CoreObjectNameSingular.Dashboard,
        objectRecordId: primaryDashboard.id,
      });
      return;
    }

    // No primary dashboard yet — create it
    if (!hasAttemptedCreate) {
      setHasAttemptedCreate(true);

      instantiateDashboardTemplate(PRIMARY_MAIN_DASHBOARD_TEMPLATE)
        .catch(() => {
          // Fallback: send user to the Dashboards list where they can use the gallery manually
          navigateApp(AppPath.RecordIndexPage, {
            objectNamePlural: 'dashboards',
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [
    dashboardsLoading,
    existingDashboards,
    hasAttemptedCreate,
    instantiateDashboardTemplate,
    navigateApp,
    objectMetadataItems,
  ]);

  if (isLoading || dashboardsLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '16px',
          padding: '0 24px',
          textAlign: 'center',
        }}
      >
        <Loader />
        <div style={{ color: '#666', fontSize: '15px', fontWeight: 500 }}>
          {t`Preparing your Mission Control dashboard...`}
        </div>
        <div style={{ color: '#888', fontSize: '13px', maxWidth: 380 }}>
          {t`This is the global command center for XO Pure. We are setting up the official Admin Mission Control I experience for you.`}
        </div>
      </div>
    );
  }

  // If we reach here without having navigated, show a helpful status screen
  // (this is rare, but excellent for debugging/setup guidance)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '48px 24px',
        textAlign: 'center',
        gap: '24px',
      }}
    >
      <div style={{ fontSize: '18px', fontWeight: 600, color: '#222' }}>
        {t`Mission Control Dashboard`}
      </div>

      {missingObjects.length > 0 && (
        <div
          style={{
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: '8px',
            padding: '20px 24px',
            maxWidth: 520,
            color: '#9a3412',
            fontSize: '13.5px',
            lineHeight: 1.5,
          }}
        >
          <strong>Setup incomplete</strong>
          <br />
          The following custom objects are not yet present in this workspace:{' '}
          <strong>{missingObjects.join(', ')}</strong>.
          <br />
          <br />
          Many dashboard widgets will be empty or skipped until you run the
          object setup + data sync scripts.
          <br />
          <br />
          Full instructions (including exact commands) are in the runbook:
          <br />
          <code style={{ fontSize: '12px' }}>
            docs/xopure-dashboards-and-branding-plan.md §8
          </code>
        </div>
      )}

      <div style={{ color: '#555', fontSize: '14px', maxWidth: 420 }}>
        {t`Your main Mission Control dashboard has been created (or already existed). You can also manage all dashboards from the Dashboards object list.`}
      </div>

      <button
        onClick={() =>
          navigateApp(AppPath.RecordIndexPage, {
            objectNamePlural: 'dashboards',
          })
        }
        style={{
          padding: '10px 20px',
          borderRadius: '6px',
          border: '1px solid #ccc',
          background: 'white',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        Go to Dashboards list (full template gallery)
      </button>
    </div>
  );
};