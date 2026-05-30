const ALLOWED_TABLES = ['orders', 'affiliates', 'customers'] as const;

export type LiveMetricTable = (typeof ALLOWED_TABLES)[number];

export const getLiveMetricTable = (): LiveMetricTable => {
  const configuredTable = process.env.XOPURE_LIVE_METRIC_TABLE?.trim();

  return ALLOWED_TABLES.find((table) => table === configuredTable) ?? 'orders';
};
