import { styled } from '@linaria/react';
import { useState } from 'react';

import {
  DASHBOARD_TEMPLATES,
  PRIMARY_MAIN_DASHBOARD_TEMPLATE,
} from '@/dashboards/templates/constants/DashboardTemplates';
import { type DashboardTemplate } from '@/dashboards/templates/types/DashboardTemplate';
import { useInstantiateDashboardTemplate } from '@/dashboards/templates/hooks/useInstantiateDashboardTemplate';
import { useLingui } from '@lingui/react/macro';
import { Button } from 'twenty-ui/input';
import { useIcons } from 'twenty-ui/display';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing[4]};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledHeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledHeaderTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledHeaderSubtitle = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[4]};
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  padding: ${themeCssVariables.spacing[4]};
  width: 100%;
`;

const StyledCard = styled.button<{ disabled: boolean; isMain: boolean }>`
  align-items: flex-start;
  background: ${themeCssVariables.background.secondary};
  border: 1px solid
    ${({ isMain }) =>
      isMain
        ? themeCssVariables.color.blue
        : themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: ${({ isMain }) =>
    isMain ? `0 0 0 1px ${themeCssVariables.color.blue}` : 'none'};
  cursor: ${({ disabled }) => (disabled ? 'progress' : 'pointer')};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
  padding: ${themeCssVariables.spacing[4]};
  text-align: left;
  transition:
    border-color 0.1s ease,
    transform 0.1s ease;

  &:hover {
    border-color: ${({ disabled }) =>
      disabled
        ? themeCssVariables.border.color.medium
        : themeCssVariables.color.blue};
    transform: ${({ disabled }) => (disabled ? 'none' : 'translateY(-2px)')};
  }
`;

const StyledIconContainer = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.color.blue};
  display: flex;
  height: 32px;
  justify-content: center;
  width: 32px;
`;

const StyledTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledDescription = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.4;
`;

export const DashboardTemplateGallery = () => {
  const { t } = useLingui();
  const { getIcon } = useIcons();
  const { instantiateDashboardTemplate, instantiateAllDashboardTemplates } =
    useInstantiateDashboardTemplate();
  const [pendingTemplateKey, setPendingTemplateKey] = useState<string | null>(
    null,
  );
  const [isCreatingAll, setIsCreatingAll] = useState(false);
  const [isCreatingMain, setIsCreatingMain] = useState(false);

  const isBusy =
    isDefined(pendingTemplateKey) || isCreatingAll || isCreatingMain;

  const handleSelectTemplate = async (template: DashboardTemplate) => {
    if (isBusy) {
      return;
    }

    setPendingTemplateKey(template.key);

    try {
      await instantiateDashboardTemplate(template);
    } finally {
      setPendingTemplateKey(null);
    }
  };

  // Prominent one-click path for the "incredible main dashboard"
  // (Admin Mission Control I — Growth & Revenue). This is the recommended
  // global command center once custom objects + front components are registered.
  const handleCreateMainDashboard = async () => {
    if (isBusy) {
      return;
    }

    setIsCreatingMain(true);

    try {
      await instantiateDashboardTemplate(PRIMARY_MAIN_DASHBOARD_TEMPLATE);
    } finally {
      setIsCreatingMain(false);
    }
  };

  const handleCreateAll = async () => {
    if (isBusy) {
      return;
    }

    setIsCreatingAll(true);

    try {
      await instantiateAllDashboardTemplates();
    } finally {
      setIsCreatingAll(false);
    }
  };

  return (
    <>
      <StyledHeader>
        <StyledHeaderText>
          <StyledHeaderTitle>{t`XO Pure Dashboard Templates`}</StyledHeaderTitle>
          <StyledHeaderSubtitle>
            {t`Create the incredible main Mission Control dashboard (recommended first step), any individual board, or seed all ${DASHBOARD_TEMPLATES.length} at once. Main dashboard uses native aggregates + record tables (plus live front-component cards once registered). Requires custom objects (ambassador, xoOrder, etc.) + Front Components from setup scripts + Supabase sync.`}
          </StyledHeaderSubtitle>
        </StyledHeaderText>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            accent="blue"
            size="small"
            Icon={getIcon('IconLayoutDashboard')}
            title={t`Create Incredible Main Dashboard (Admin Mission Control I)`}
            isLoading={isCreatingMain}
            disabled={isBusy}
            onClick={handleCreateMainDashboard}
          />
          <Button
            variant="secondary"
            size="small"
            Icon={getIcon('IconLayoutGrid')}
            title={t`Create all dashboards`}
            isLoading={isCreatingAll}
            disabled={isBusy}
            onClick={handleCreateAll}
          />
        </div>
      </StyledHeader>
      <StyledGrid>
        {DASHBOARD_TEMPLATES.map((template) => {
          const TemplateIcon = getIcon(template.icon);
          const isPending = pendingTemplateKey === template.key;
          const isMain = template.key === PRIMARY_MAIN_DASHBOARD_TEMPLATE.key;

          return (
            <StyledCard
              key={template.key}
              type="button"
              disabled={isBusy}
              isMain={isMain}
              onClick={() => handleSelectTemplate(template)}
            >
              <StyledIconContainer>
                {isDefined(TemplateIcon) ? <TemplateIcon size={20} /> : null}
              </StyledIconContainer>
              <StyledTitle>
                {isPending ? `${template.name}…` : template.name}
                {isMain && ' ★'}
              </StyledTitle>
              <StyledDescription>{template.description}</StyledDescription>
            </StyledCard>
          );
        })}
      </StyledGrid>
    </>
  );
};
