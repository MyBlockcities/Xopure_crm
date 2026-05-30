import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { FIND_MANY_FRONT_COMPONENTS } from '@/front-components/graphql/queries/findManyFrontComponents';
import { type DashboardTemplate } from '@/dashboards/templates/types/DashboardTemplate';
import { buildDraftPageLayoutFromTemplate } from '@/dashboards/templates/utils/buildDraftPageLayoutFromTemplate';
import { useUpdatePageLayoutWithTabsAndWidgets } from '@/page-layout/hooks/useUpdatePageLayoutWithTabsAndWidgets';
import { convertPageLayoutDraftToUpdateInput } from '@/page-layout/utils/convertPageLayoutDraftToUpdateInput';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useLingui } from '@lingui/react/macro';
import { useQuery } from '@apollo/client';
import { isNonEmptyString } from '@sniptt/guards';
import { AppPath, CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { useNavigateApp } from '~/hooks/useNavigateApp';
import { type FrontComponent } from '~/generated-metadata/graphql';

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

  const instantiateDashboardTemplate = async (template: DashboardTemplate) => {
    const createdDashboard = await createOneRecord({
      title: template.name,
    });

    const pageLayoutId = createdDashboard?.pageLayoutId;

    if (!isDefined(pageLayoutId) || !isNonEmptyString(pageLayoutId)) {
      enqueueErrorSnackBar({
        message: t`Failed to create dashboard from template`,
      });

      return;
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

    if (result.status !== 'successful') {
      enqueueErrorSnackBar({
        message: t`Failed to populate dashboard template`,
      });

      return createdDashboard;
    }

    enqueueSuccessSnackBar({
      message: t`Dashboard created from template`,
    });

    navigate(AppPath.RecordShowPage, {
      objectNameSingular: CoreObjectNameSingular.Dashboard,
      objectRecordId: createdDashboard.id,
    });

    return createdDashboard;
  };

  return { instantiateDashboardTemplate };
};
