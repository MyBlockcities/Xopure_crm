// The persisted GaugeChartConfiguration has no goal/range/max field yet, so the
// gauge's upper bound is derived from the aggregate value itself. Ratios and
// percentage-like values cap at 1 / 100; larger values round up to a "nice"
// ceiling (1 / 2 / 5 x power of ten) so the gauge shows a meaningful partial fill
// instead of always reading as empty or full.
// A persisted min/max/goal model is the real follow-up; see the dashboards plan doc.
export const deriveGaugeMax = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return 100;
  }

  if (value <= 1) {
    return 1;
  }

  if (value <= 100) {
    return 100;
  }

  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const niceStep =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return niceStep * magnitude;
};
