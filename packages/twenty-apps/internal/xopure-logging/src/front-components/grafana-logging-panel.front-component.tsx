import { defineFrontComponent } from 'twenty-sdk/define';
import { getApplicationVariable, useRecordId, useUserId } from 'twenty-sdk/front-component';
import { GRAFANA_PANEL_COMPONENT_ID } from '../constants/universal-identifiers';
import { buildGrafanaIframeUrl } from '../utils/build-grafana-iframe-url';

const MAX_RECORD_VAR_LENGTH = 64;
const MAX_USER_VAR_LENGTH = 64;

const sanitizeVar = (val: string | null | undefined, max: number): string | null => {
  if (!val) return null;
  const cleaned = val.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, max);
  return cleaned.length > 0 ? cleaned : null;
};

export const GrafanaLoggingPanel = () => {
  const grafanaUrl = getApplicationVariable('GRAFANA_URL');
  const recordId = useRecordId();
  const userId = useUserId();
  if (!grafanaUrl) {
    return (
      <div style={{ padding: 20, color: '#666', fontFamily: 'sans-serif' }}>
        Grafana URL not configured. Set the GRAFANA_URL application variable.
      </div>
    );
  }

  const safeRecordVar = sanitizeVar(recordId, MAX_RECORD_VAR_LENGTH);
  const safeUserVar = sanitizeVar(userId, MAX_USER_VAR_LENGTH);

  const iframeUrl = buildGrafanaIframeUrl({
    grafanaUrl,
    recordVar: safeRecordVar,
    userVar: safeUserVar,
  });

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 400, border: 'none' }}>
      <iframe
        src={iframeUrl}
        title="Grafana Logging Panel"
        style={{ width: '100%', height: '100%', border: 'none' }}
        sandbox="allow-scripts allow-same-origin allow-forms"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: GRAFANA_PANEL_COMPONENT_ID,
  name: 'grafana-logging-panel',
  description: 'Embeds a Grafana logging panel with Loki/Tempo datasources, scoped to the current record context.',
  component: GrafanaLoggingPanel,
});
