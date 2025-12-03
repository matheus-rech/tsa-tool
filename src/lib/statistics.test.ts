import { describe, it, expect } from 'vitest';
import {
  normalCDF,
  normalQuantile,
  lanDeMetsAlphaSpending,
  lanDeMetsBetaSpending,
  computeMonitoringBoundary,
  computeFutilityBoundary,
  calculateStudyOR,
  calculatePooledOR,
  calculateRIS,
  calculateHeterogeneity,
  calculateTSA
} from './statistics';
import { Study, TSAParams } from '@/types';

describe('normalCDF', () => {
  it('returns 0.5 for z = 0', () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 5);
  });

  it('returns approximately 0.975 for z = 1.96', () => {
    expect(normalCDF(1.96)).toBeCloseTo(0.975, 3);
  });

  it('returns approximately 0.025 for z = -1.96', () => {
    expect(normalCDF(-1.96)).toBeCloseTo(0.025, 3);
  });

  it('returns approximately 0.8413 for z = 1', () => {
    expect(normalCDF(1)).toBeCloseTo(0.8413, 3);
  });

  it('returns approximately 0.1587 for z = -1', () => {
    expect(normalCDF(-1)).toBeCloseTo(0.1587, 3);
  });
});

describe('normalQuantile', () => {
  it('returns 0 for p = 0.5', () => {
    expect(normalQuantile(0.5)).toBeCloseTo(0, 5);
  });

  it('returns approximately 1.96 for p = 0.975', () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.96, 2);
  });

  it('returns approximately -1.96 for p = 0.025', () => {
    expect(normalQuantile(0.025)).toBeCloseTo(-1.96, 2);
  });
});

describe('lanDeMetsAlphaSpending', () => {
  it('returns 0 at t = 0', () => {
    expect(lanDeMetsAlphaSpending(0, 0.05)).toBe(0);
  });

  it('returns alpha at t = 1', () => {
    expect(lanDeMetsAlphaSpending(1, 0.05)).toBe(0.05);
  });

  it('spends very little alpha at early looks', () => {
    const earlySpending = lanDeMetsAlphaSpending(0.1, 0.05);
    expect(earlySpending).toBeLessThan(0.001);
  });

  it('increases monotonically', () => {
    const s1 = lanDeMetsAlphaSpending(0.25, 0.05);
    const s2 = lanDeMetsAlphaSpending(0.5, 0.05);
    const s3 = lanDeMetsAlphaSpending(0.75, 0.05);
    const s4 = lanDeMetsAlphaSpending(1.0, 0.05);

    expect(s1).toBeLessThan(s2);
    expect(s2).toBeLessThan(s3);
    expect(s3).toBeLessThan(s4);
  });
});

describe('lanDeMetsBetaSpending', () => {
  it('returns 0 at t = 0', () => {
    expect(lanDeMetsBetaSpending(0, 0.20)).toBe(0);
  });

  it('returns beta at t = 1', () => {
    expect(lanDeMetsBetaSpending(1, 0.20)).toBe(0.20);
  });
});

describe('computeMonitoringBoundary', () => {
  it('returns very high boundary at low information', () => {
    const boundary = computeMonitoringBoundary(0.1, 0.05);
    expect(boundary).toBeGreaterThan(5);
  });

  it('converges to z_alpha/2 as information approaches 1', () => {
    const boundary = computeMonitoringBoundary(1.0, 0.05);
    expect(boundary).toBeCloseTo(1.96, 1);
  });

  it('decreases as information increases', () => {
    const b1 = computeMonitoringBoundary(0.25, 0.05);
    const b2 = computeMonitoringBoundary(0.5, 0.05);
    const b3 = computeMonitoringBoundary(0.75, 0.05);

    expect(b1).toBeGreaterThan(b2);
    expect(b2).toBeGreaterThan(b3);
  });
});

describe('computeFutilityBoundary', () => {
  it('returns 0 when type is none', () => {
    const boundary = computeFutilityBoundary(0.5, 0.20, 'none');
    expect(boundary).toBe(0);
  });

  it('returns positive value for obrien-fleming', () => {
    const boundary = computeFutilityBoundary(0.5, 0.20);
    expect(boundary).toBeGreaterThan(0);
  });

  it('is smaller than monitoring boundary at same fraction', () => {
    const futility = computeFutilityBoundary(0.5, 0.20);
    const monitoring = computeMonitoringBoundary(0.5, 0.05);
    expect(futility).toBeLessThan(monitoring);
  });
});

describe('calculateStudyOR', () => {
  it('calculates correct OR without zero cells', () => {
    const study: Study = {
      id: '1',
      name: 'Test',
      year: 2020,
      eventsTrt: 20,
      totalTrt: 100,
      eventsCtrl: 30,
      totalCtrl: 100
    };

    const result = calculateStudyOR(study);
    // OR = (20 * 70) / (80 * 30) = 1400 / 2400 = 0.583
    expect(result.or).toBeCloseTo(0.583, 2);
  });

  it('applies continuity correction with zero cell', () => {
    const study: Study = {
      id: '1',
      name: 'Test',
      year: 2020,
      eventsTrt: 0,
      totalTrt: 50,
      eventsCtrl: 10,
      totalCtrl: 50
    };

    const result = calculateStudyOR(study);
    expect(result.or).toBeLessThan(1); // Should favor treatment
    expect(isFinite(result.se)).toBe(true);
  });

  it('handles double-zero study', () => {
    const study: Study = {
      id: '1',
      name: 'Test',
      year: 2020,
      eventsTrt: 0,
      totalTrt: 50,
      eventsCtrl: 0,
      totalCtrl: 50
    };

    const result = calculateStudyOR(study);
    expect(isFinite(result.or)).toBe(true);
    expect(isFinite(result.se)).toBe(true);
  });
});

describe('calculatePooledOR', () => {
  it('calculates pooled OR using Mantel-Haenszel method', () => {
    const studies: Study[] = [
      { id: '1', name: 'Study1', year: 2020, eventsTrt: 20, totalTrt: 100, eventsCtrl: 30, totalCtrl: 100 },
      { id: '2', name: 'Study2', year: 2021, eventsTrt: 15, totalTrt: 80, eventsCtrl: 25, totalCtrl: 80 }
    ];

    const result = calculatePooledOR(studies);
    expect(result.or).toBeLessThan(1); // Favors treatment
    expect(result.or).toBeGreaterThan(0.3); // Reasonable range
    expect(isFinite(result.se)).toBe(true);
  });

  it('filters out double-zero studies', () => {
    const studies: Study[] = [
      { id: '1', name: 'Study1', year: 2020, eventsTrt: 10, totalTrt: 50, eventsCtrl: 20, totalCtrl: 50 },
      { id: '2', name: 'Study2', year: 2021, eventsTrt: 0, totalTrt: 30, eventsCtrl: 0, totalCtrl: 30 }
    ];

    const result = calculatePooledOR(studies);
    expect(isFinite(result.or)).toBe(true);
    expect(isFinite(result.se)).toBe(true);
  });
});

describe('calculateRIS', () => {
  it('calculates RIS for typical parameters', () => {
    const params: TSAParams = {
      alpha: 0.05,
      beta: 0.20,
      controlRate: 0.10,
      effectSize: 30, // 30% RRR
      heterogeneityCorrection: 1.0
    };

    const ris = calculateRIS(params);
    expect(ris).toBeGreaterThan(1000);
    expect(ris).toBeLessThan(50000);
  });

  it('increases RIS with smaller effect size', () => {
    const params1: TSAParams = {
      alpha: 0.05,
      beta: 0.20,
      controlRate: 0.10,
      effectSize: 50,
      heterogeneityCorrection: 1.0
    };

    const params2: TSAParams = {
      ...params1,
      effectSize: 25
    };

    const ris1 = calculateRIS(params1);
    const ris2 = calculateRIS(params2);

    expect(ris2).toBeGreaterThan(ris1);
  });

  it('applies heterogeneity correction', () => {
    const params1: TSAParams = {
      alpha: 0.05,
      beta: 0.20,
      controlRate: 0.10,
      effectSize: 30,
      heterogeneityCorrection: 1.0
    };

    const params2: TSAParams = {
      ...params1,
      heterogeneityCorrection: 1.5
    };

    const ris1 = calculateRIS(params1);
    const ris2 = calculateRIS(params2);

    expect(ris2).toBeCloseTo(ris1 * 1.5, -2);
  });
});

describe('calculateHeterogeneity', () => {
  it('returns zero heterogeneity for single study', () => {
    const studies: Study[] = [
      { id: '1', name: 'Study1', year: 2020, eventsTrt: 20, totalTrt: 100, eventsCtrl: 30, totalCtrl: 100 }
    ];

    const result = calculateHeterogeneity(studies);
    expect(result.q).toBe(0);
    expect(result.i2).toBe(0);
  });

  it('calculates valid Q statistic', () => {
    const studies: Study[] = [
      { id: '1', name: 'Study1', year: 2020, eventsTrt: 10, totalTrt: 100, eventsCtrl: 30, totalCtrl: 100 },
      { id: '2', name: 'Study2', year: 2021, eventsTrt: 25, totalTrt: 100, eventsCtrl: 25, totalCtrl: 100 }
    ];

    const result = calculateHeterogeneity(studies);
    expect(result.q).toBeGreaterThanOrEqual(0);
    expect(result.i2).toBeGreaterThanOrEqual(0);
    expect(result.i2).toBeLessThanOrEqual(100);
  });
});

describe('calculateTSA', () => {
  const exampleStudies: Study[] = [
    { id: '1', name: 'Study1', year: 2020, eventsTrt: 20, totalTrt: 200, eventsCtrl: 35, totalCtrl: 200 },
    { id: '2', name: 'Study2', year: 2021, eventsTrt: 15, totalTrt: 150, eventsCtrl: 28, totalCtrl: 150 },
    { id: '3', name: 'Study3', year: 2022, eventsTrt: 12, totalTrt: 100, eventsCtrl: 22, totalCtrl: 100 }
  ];

  const params: TSAParams = {
    alpha: 0.05,
    beta: 0.20,
    controlRate: 0.15,
    effectSize: 35,
    heterogeneityCorrection: 1.2
  };

  it('returns null for empty studies', () => {
    const result = calculateTSA([], params);
    expect(result).toBeNull();
  });

  it('calculates complete TSA results', () => {
    const result = calculateTSA(exampleStudies, params);

    expect(result).not.toBeNull();
    expect(result!.ris).toBeGreaterThan(0);
    expect(result!.cumulativeData.length).toBe(exampleStudies.length);
    expect(result!.interpretation).toBeDefined();
  });

  it('includes alpha and beta spending in cumulative data', () => {
    const result = calculateTSA(exampleStudies, params);

    expect(result).not.toBeNull();
    result!.cumulativeData.forEach(point => {
      expect(point.alphaSpent).toBeGreaterThanOrEqual(0);
      expect(point.alphaSpent).toBeLessThanOrEqual(params.alpha);
      expect(point.betaSpent).toBeGreaterThanOrEqual(0);
      expect(point.betaSpent).toBeLessThanOrEqual(params.beta);
    });
  });

  it('cumulative data has increasing patient count', () => {
    const result = calculateTSA(exampleStudies, params);

    expect(result).not.toBeNull();
    for (let i = 1; i < result!.cumulativeData.length; i++) {
      expect(result!.cumulativeData[i].patients).toBeGreaterThan(
        result!.cumulativeData[i - 1].patients
      );
    }
  });

  it('monitoring boundaries decrease with information fraction', () => {
    const result = calculateTSA(exampleStudies, params);

    expect(result).not.toBeNull();
    for (let i = 1; i < result!.cumulativeData.length; i++) {
      expect(result!.cumulativeData[i].monitoringBoundary).toBeLessThanOrEqual(
        result!.cumulativeData[i - 1].monitoringBoundary
      );
    }
  });
});
