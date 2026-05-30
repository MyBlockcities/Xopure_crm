import { deriveGaugeMax } from '@/page-layout/widgets/graph/graph-widget-gauge-chart/utils/deriveGaugeMax';

describe('deriveGaugeMax', () => {
  it('should default to 100 for non-finite or non-positive values', () => {
    expect(deriveGaugeMax(NaN)).toBe(100);
    expect(deriveGaugeMax(Infinity)).toBe(100);
    expect(deriveGaugeMax(0)).toBe(100);
    expect(deriveGaugeMax(-5)).toBe(100);
  });

  it('should cap ratios in the 0..1 range at 1', () => {
    expect(deriveGaugeMax(0.25)).toBe(1);
    expect(deriveGaugeMax(1)).toBe(1);
  });

  it('should treat percentage-like values up to 100 with a max of 100', () => {
    expect(deriveGaugeMax(50)).toBe(100);
    expect(deriveGaugeMax(100)).toBe(100);
  });

  it('should round larger values up to a nice 1/2/5 ceiling', () => {
    expect(deriveGaugeMax(150)).toBe(200);
    expect(deriveGaugeMax(420)).toBe(500);
    expect(deriveGaugeMax(880)).toBe(1000);
    expect(deriveGaugeMax(12000)).toBe(20000);
  });

  it('should keep an exact nice value unchanged', () => {
    expect(deriveGaugeMax(2000)).toBe(2000);
    expect(deriveGaugeMax(5000)).toBe(5000);
  });
});
