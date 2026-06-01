import { RecordIndexCommandMenu } from '@/command-menu-item/components/RecordIndexCommandMenu';
import {
  DASHBOARD_TEMPLATE_GALLERY_MODAL_ID,
  DashboardTemplateGalleryModal,
} from '@/dashboards/templates/components/DashboardTemplateGalleryModal';
import { SidePanelToggleButton } from '@/side-panel/components/SidePanelToggleButton';
import { MAIN_CONTEXT_STORE_INSTANCE_ID } from '@/context-store/constants/MainContextStoreInstanceId';
import { contextStoreCurrentViewIdComponentState } from '@/context-store/states/contextStoreCurrentViewIdComponentState';
import { contextStoreNumberOfSelectedRecordsComponentState } from '@/context-store/states/contextStoreNumberOfSelectedRecordsComponentState';
import { isLayoutCustomizationModeEnabledState } from '@/layout-customization/states/isLayoutCustomizationModeEnabledState';
import { useFilteredObjectMetadataItems } from '@/object-metadata/hooks/useFilteredObjectMetadataItems';
import { RecordIndexPageHeaderIcon } from '@/object-record/record-index/components/RecordIndexPageHeaderIcon';
import { useRecordIndexContextOrThrow } from '@/object-record/record-index/contexts/RecordIndexContext';
import { useModal } from '@/ui/layout/modal/hooks/useModal';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { isDefined } from 'twenty-shared/utils';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { IconLayoutDashboard, IconLayoutGrid } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledTitleWithSelectedRecords = styled.div`
  display: flex;
  flex-direction: row;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  padding-right: ${themeCssVariables.spacing['0.5']};
`;

const StyledSelectedRecordsCount = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  padding-left: ${themeCssVariables.spacing['0.5']};
`;

export const RecordIndexPageHeader = () => {
  const { openModal } = useModal();
  const { findObjectMetadataItemByNamePlural } =
    useFilteredObjectMetadataItems();

  const contextStoreNumberOfSelectedRecords = useAtomComponentStateValue(
    contextStoreNumberOfSelectedRecordsComponentState,
  );

  const { objectNamePlural } = useRecordIndexContextOrThrow();

  const objectMetadataItem =
    findObjectMetadataItemByNamePlural(objectNamePlural);

  const label = objectMetadataItem?.labelPlural ?? objectNamePlural;

  const pageHeaderTitle =
    contextStoreNumberOfSelectedRecords > 0 ? (
      <StyledTitleWithSelectedRecords>
        <StyledTitle>{label}</StyledTitle>
        <>{'->'}</>
        <StyledSelectedRecordsCount>
          {t`${contextStoreNumberOfSelectedRecords} selected`}
        </StyledSelectedRecordsCount>
      </StyledTitleWithSelectedRecords>
    ) : (
      label
    );

  const contextStoreCurrentViewId = useAtomComponentStateValue(
    contextStoreCurrentViewIdComponentState,
    MAIN_CONTEXT_STORE_INSTANCE_ID,
  );
  const isLayoutCustomizationModeEnabled = useAtomStateValue(
    isLayoutCustomizationModeEnabledState,
  );
  const isDashboardIndex =
    objectMetadataItem?.nameSingular === CoreObjectNameSingular.Dashboard;

  return (
    <PageHeader
      title={pageHeaderTitle}
      Icon={() => (
        <RecordIndexPageHeaderIcon objectMetadataItem={objectMetadataItem} />
      )}
    >
      {isDefined(contextStoreCurrentViewId) && (
        <>
          <RecordIndexCommandMenu />
          {isDashboardIndex && (
            <>
              {/* Prominent entry to the incredible main dashboard (Admin Mission Control I).
                  Opens the gallery which now heroes the one-click "Create Incredible Main Dashboard" action. */}
              <Button
                size="small"
                variant="primary"
                accent="blue"
                title={t`Create Main Mission Control`}
                Icon={IconLayoutDashboard}
                onClick={() => {
                  openModal(DASHBOARD_TEMPLATE_GALLERY_MODAL_ID);
                }}
              />
              <Button
                size="small"
                variant="secondary"
                title={t`All templates`}
                Icon={IconLayoutGrid}
                onClick={() => {
                  openModal(DASHBOARD_TEMPLATE_GALLERY_MODAL_ID);
                }}
              />
              <DashboardTemplateGalleryModal />
            </>
          )}
          {!isLayoutCustomizationModeEnabled && <SidePanelToggleButton />}
        </>
      )}
    </PageHeader>
  );
};
