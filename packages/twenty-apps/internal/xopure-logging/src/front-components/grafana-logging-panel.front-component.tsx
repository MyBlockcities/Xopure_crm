import { defineFrontComponent } from 'twenty-sdk/define';
import {
  getApplicationVariable,
  useRecordId,
  useUserId,
} from 'twenty-sdk/front-component';

import { GRAFANA_PANEL_COMPONENT_ID } from 'src/constants/universal-identifiers';
import { buildGrafanaIframeUrl } from 'src/utils/grafana-url';

const containerStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  height: '100%',
  minHeight: '640px',
  padding: '16px',
} as const;

const messageStyle = {
  border: '1px solid #d0d5dd',
  borderRadius: '8px',
  color: '#344054',
  padding: '12px',
} as const;

const GrafanaLoggingPanel = () => {
  const grafanaUrl = getApplicationVariable('GRAFANA_URL');
  const recordId = useRecordId();
  const userId = useUserId();

  if (!grafanaUrl) {
    return <div style={messageStyle}>GRAFANA_URL is not configured for XO Pure Logging.</div>;
  }

  if (!recordId || !userId) {
    return (
      <div style={messageStyle}>
        Open the logging panel from a record context so Grafana can receive record and user URL variables.
      </div>
    );
  }

  let iframeUrl: string;
  try {
    iframeUrl = buildGrafanaIframeUrl(grafanaUrl, recordId, userId, {
      from: 'now-6h',
      to: 'now',
    });
  } catch {
    return <div style={messageStyle}>GRAFANA_URL is invalid for embedded logging.</div>;
  }

  return (
    <section style={containerStyle}>
      <iframe
        src={iframeUrl}
        title="XO Pure Grafana logging panel"
        style={{ border: 0, flex: 1, minHeight: '640px', width: '100%' }}
      />
    </section>
  );
};

export default defineFrontComponent({
  universalIdentifier: GRAFANA_PANEL_COMPONENT_ID,
  name: 'XO Pure Logging Panel',
  description: 'Embeds Grafana with current record and user context variables.',
  component: GrafanaLoggingPanel,
});
