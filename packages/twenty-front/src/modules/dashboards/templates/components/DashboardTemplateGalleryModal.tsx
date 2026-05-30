import { DashboardTemplateGallery } from '@/dashboards/templates/components/DashboardTemplateGallery';
import { ModalStatefulWrapper } from '@/ui/layout/modal/components/ModalStatefulWrapper';
import { ModalContent, ModalHeader } from 'twenty-ui/layout';

export const DASHBOARD_TEMPLATE_GALLERY_MODAL_ID =
  'dashboard-template-gallery-modal';

export const DashboardTemplateGalleryModal = () => (
  <ModalStatefulWrapper
    modalInstanceId={DASHBOARD_TEMPLATE_GALLERY_MODAL_ID}
    size="large"
    padding="none"
    isClosable
  >
    <ModalHeader>XO Pure dashboard templates</ModalHeader>
    <ModalContent noPadding>
      <DashboardTemplateGallery />
    </ModalContent>
  </ModalStatefulWrapper>
);
