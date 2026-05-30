import { styled } from '@linaria/react';
import { useState } from 'react';

import { DASHBOARD_TEMPLATES } from '@/dashboards/templates/constants/DashboardTemplates';
import { type DashboardTemplate } from '@/dashboards/templates/types/DashboardTemplate';
import { useInstantiateDashboardTemplate } from '@/dashboards/templates/hooks/useInstantiateDashboardTemplate';
import { useIcons } from 'twenty-ui/display';
import { isDefined } from 'twenty-shared/utils';

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
  const { getIcon } = useIcons();
  const { instantiateDashboardTemplate } = useInstantiateDashboardTemplate();
  const [pendingTemplateKey, setPendingTemplateKey] = useState<string | null>(
    null,
  );

  const handleSelectTemplate = async (template: DashboardTemplate) => {
    if (isDefined(pendingTemplateKey)) {
      return;
    }

    setPendingTemplateKey(template.key);

    try {
      await instantiateDashboardTemplate(template);
    } finally {
      setPendingTemplateKey(null);
    }
  };

  return (
    <StyledGrid>
      {DASHBOARD_TEMPLATES.map((template) => {
        const TemplateIcon = getIcon(template.icon);
        const isPending = pendingTemplateKey === template.key;

        return (
          <StyledCard
            key={template.key}
            type="button"
            disabled={isDefined(pendingTemplateKey)}
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
  );
};
