type GrafanaIframeUrlInput = {
  grafanaUrl: string;
  recordVar: string | null;
  userVar: string | null;
};

export const buildGrafanaIframeUrl = ({
  grafanaUrl,
  recordVar,
  userVar,
}: GrafanaIframeUrlInput): string => {
  const url = new URL(grafanaUrl);

  url.searchParams.set('kiosk', '');
  if (recordVar) url.searchParams.set('var-recordId', recordVar);
  if (userVar) url.searchParams.set('var-userId', userVar);

  return url.toString();
};
