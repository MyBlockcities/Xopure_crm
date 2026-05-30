import { styled } from '@linaria/react';
import { useState } from 'react';

import { DASHBOARD_TEMPLATES } from '@/dashboards/templates/constants/DashboardTemplates';
import { type DashboardTemplate } from '@/dashboards/templates/types/DashboardTemplate';
import { useInstantiateDashboardTemplate } from '@/dashboards/templates/hooks/useInstantiateDashboardTemplate';
import { useLingui } from '@lingui/react/macro';
import { Button } from 'twenty-ui/input';
import { useIcons } from 'twenty-ui/display';
import { isDefined } from 'twenty-shared/utils';

const StyledHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  gap: ${({ theme }) => theme.spacing(4)};
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledHeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledHeaderTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledHeaderSubtitle = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledGrid = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing(4)};
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  padding: ${({ theme }) => theme.spacing(4)};
  width: 100%;
`;

const StyledCard = styled.button<{ disabled: boolean }>`
  align-items: flex-start;
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  cursor: ${({ disabled }) => (disabled ? 'progress' : 'pointer')};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
  padding: ${({ theme }) => theme.spacing(4)};
  text-align: left;
  transition: border-color 0.1s ease, transform 0.1s ease;

  &:hover {
    border-color: ${({ theme, disabled }) =>
      disabled ? theme.border.color.medium : theme.color.blue};
    transform: ${({ disabled }) => (disabled ? 'none' : 'translateY(-2px)')};
  }
`;

const StyledIconContainer = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.color.blue};
  display: flex;
  height: 32px;
  justify-content: center;
  width: 32px;
`;

const StyledTitle = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledDescription = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
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

  const isBusy = isDefined(pendingTemplateKey) || isCreatingAll;

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
          <StyledHeaderTitle>{t`Dashboard templates`}</StyledHeaderTitle>
          <StyledHeaderSubtitle>
            {t`Create one board, or seed all ${DASHBOARD_TEMPLATES.length} at once.`}
          </StyledHeaderSubtitle>
        </StyledHeaderText>
        <Button
          variant="primary"
          accent="blue"
          size="small"
          Icon={getIcon('IconLayoutGrid')}
          title={t`Create all dashboards`}
          isLoading={isCreatingAll}
          disabled={isBusy}
          onClick={handleCreateAll}
        />
      </StyledHeader>
      <StyledGrid>
        {DASHBOARD_TEMPLATES.map((template) => {
          const TemplateIcon = getIcon(template.icon);
          const isPending = pendingTemplateKey === template.key;

          return (
            <StyledCard
              key={template.key}
              type="button"
              disabled={isBusy}
              onClick={() => handleSelectTemplate(template)}
            >
              <StyledIconContainer>
                {isDefined(TemplateIcon) ? <TemplateIcon size={20} /> : null}
              </StyledIconContainer>
              <StyledTitle>
                {isPending ? `${template.name}…` : template.name}
              </StyledTitle>
              <StyledDescription>{template.description}</StyledDescription>
            </StyledCard>
          );
        })}
      </StyledGrid>
    </>
  );
};
