import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { FIND_MANY_FRONT_COMPONENTS } from '@/front-components/graphql/queries/findManyFrontComponents';
import { DASHBOARD_TEMPLATES } from '@/dashboards/templates/constants/DashboardTemplates';
import { type DashboardTemplate } from '@/dashboards/templates/types/DashboardTemplate';
import { buildDraftPageLayoutFromTemplate } from '@/dashboards/templates/utils/buildDraftPageLayoutFromTemplate';
import { useUpdatePageLayoutWithTabsAndWidgets } from '@/page-layout/hooks/useUpdatePageLayoutWithTabsAndWidgets';
import { convertPageLayoutDraftToUpdateInput } from '@/page-layout/utils/convertPageLayoutDraftToUpdateInput';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useLingui } from '@lingui/react/macro';
import { useQuery } from '@apollo/client/react';
import { isNonEmptyString } from '@sniptt/guards';
import { AppPath, CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { useNavigateApp } from '~/hooks/useNavigateApp';
import { type FrontComponent } from '~/generated-metadata/graphql';

type InstantiateOneResult = {
  status: 'successful' | 'partial' | 'failed';
  dashboardId?: string;
};

export const useInstantiateDashboardTemplate = () => {
  const { createOneRecord } = useCreateOneRecord({
    objectNameSingular: CoreObjectNameSingular.Dashboard,
  });
  const { objectMetadataItems } = useObjectMetadataItems();
  const { data: frontComponentsData } = useQuery<{
    frontComponents: FrontComponent[];
  }>(FIND_MANY_FRONT_COMPONENTS);
  const { updatePageLayoutWithTabsAndWidgets } =
    useUpdatePageLayoutWithTabsAndWidgets();
  const navigate = useNavigateApp();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const { t } = useLingui();

  const resolveObjectMetadataId = (objectNameSingular: string) =>
    objectMetadataItems.find(
      (objectMetadataItem) =>
        objectMetadataItem.nameSingular === objectNameSingular,
    )?.id;

  const resolveFieldMetadataId = (
    objectNameSingular: string,
    fieldName: string,
  ) =>
    objectMetadataItems
      .find(
        (objectMetadataItem) =>
          objectMetadataItem.nameSingular === objectNameSingular,
      )
      ?.fields.find((field) => field.name === fieldName)?.id;

  const resolveFrontComponentId = (universalIdentifier: string) =>
    frontComponentsData?.frontComponents.find(
      (frontComponent) =>
        frontComponent.universalIdentifier === universalIdentifier,
    )?.id;

  // Creates a single dashboard record + populates its page layout from the
  // template, without navigating or showing snackbars. Shared by the single
  // and bulk entry points so both go through the exact same, tested path.
  const instantiateOneDashboardTemplate = async (
    template: DashboardTemplate,
  ): Promise<InstantiateOneResult> => {
    const createdDashboard = await createOneRecord({
      title: template.name,
    });

    const pageLayoutId = createdDashboard?.pageLayoutId;

    if (!isDefined(pageLayoutId) || !isNonEmptyString(pageLayoutId)) {
      return { status: 'failed', dashboardId: createdDashboard?.id };
    }

    const draftPageLayout = buildDraftPageLayoutFromTemplate({
      template,
      pageLayoutId,
      resolveObjectMetadataId,
      resolveFieldMetadataId,
      resolveFrontComponentId,
    });

    const updateInput = convertPageLayoutDraftToUpdateInput(draftPageLayout);

    const result = await updatePageLayoutWithTabsAndWidgets(
      pageLayoutId,
      updateInput,
    );

    return {
      status: result.status === 'successful' ? 'successful' : 'partial',
      dashboardId: createdDashboard.id,
    };
  };

  const instantiateDashboardTemplate = async (template: DashboardTemplate) => {
    const { status, dashboardId } =
      await instantiateOneDashboardTemplate(template);

    if (status === 'failed') {
      enqueueErrorSnackBar({
        message: t`Failed to create dashboard from template`,
      });

      return;
    }

    if (status === 'partial') {
      enqueueErrorSnackBar({
        message: t`Failed to populate dashboard template`,
      });
    } else {
      enqueueSuccessSnackBar({
        message: t`Dashboard created from template`,
      });
    }

    if (isDefined(dashboardId)) {
      navigate(AppPath.RecordShowPage, {
        objectNameSingular: CoreObjectNameSingular.Dashboard,
        objectRecordId: dashboardId,
      });
    }

    return dashboardId;
  };

  // Seeds every curated template as its own dashboard, in sequence. Runs in the
  // user's authenticated session and resolves object/field ids from live
  // workspace metadata, so any card whose object/field is missing is skipped
  // (non-destructively) by the builder rather than failing the whole batch.
  const instantiateAllDashboardTemplates = async () => {
    let created = 0;
    let failed = 0;
    let firstDashboardId: string | undefined;

    for (const template of DASHBOARD_TEMPLATES) {
      const { status, dashboardId } =
        await instantiateOneDashboardTemplate(template);

      if (status === 'failed') {
        failed += 1;
        continue;
      }

      created += 1;

      if (!isDefined(firstDashboardId) && isDefined(dashboardId)) {
        firstDashboardId = dashboardId;
      }
    }

    if (created > 0) {
      enqueueSuccessSnackBar({
        message: t`Created ${created} dashboards from templates`,
      });
    }

    if (failed > 0) {
      enqueueErrorSnackBar({
        message: t`${failed} dashboard(s) could not be created`,
      });
    }

    if (isDefined(firstDashboardId)) {
      navigate(AppPath.RecordShowPage, {
        objectNameSingular: CoreObjectNameSingular.Dashboard,
        objectRecordId: firstDashboardId,
      });
    }
  };

  return { instantiateDashboardTemplate, instantiateAllDashboardTemplates };
};
