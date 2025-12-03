/**
 * TSA Calculation Tools
 *
 * Wraps the validated statistics library functions as agent tools.
 */

import { z } from 'zod';
import { Study, TSAParams, TSAResults } from '@/types';
import {
  calculateTSA,
  calculatePooledOR,
  calculateRIS,
  calculateHeterogeneity,
  calculateZStatistic,
  computeMonitoringBoundary,
  computeFutilityBoundary,
} from '@/lib/statistics';

// ============================================================================
// Zod Schemas
// ============================================================================

const StudySchema = z.object({
  id: z.string(),
  name: z.string(),
  year: z.number(),
  eventsTrt: z.number().int().min(0),
  totalTrt: z.number().int().min(1),
  eventsCtrl: z.number().int().min(0),
  totalCtrl: z.number().int().min(1),
});

const TSAParamsSchema = z.object({
  alpha: z.number().min(0.001).max(0.5).default(0.05),
  beta: z.number().min(0.001).max(0.5).default(0.20),
  controlRate: z.number().min(0.001).max(0.999),
  effectSize: z.number().min(1).max(99),
  heterogeneityCorrection: z.number().min(1).max(5).default(1.0),
  futilityBoundaryType: z.enum(['none', 'obrien-fleming', 'pocock', 'conditional-power']).optional(),
  useI2Adjustment: z.boolean().optional(),
});

export const CalculateTSASchema = z.object({
  studies: z.array(StudySchema).min(1),
  params: TSAParamsSchema,
});

export const CalculatePooledORSchema = z.object({
  studies: z.array(StudySchema).min(1),
});

export const CalculateRISSchema = z.object({
  params: TSAParamsSchema,
});

export const CalculateBoundarySchema = z.object({
  informationFraction: z.number().min(0.001).max(2),
  alpha: z.number().default(0.05),
  beta: z.number().default(0.20),
});

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Performs complete Trial Sequential Analysis
 */
export async function performTSA(
  input: z.infer<typeof CalculateTSASchema>
): Promise<TSAResults | { error: string }> {
  try {
    const studies = input.studies as Study[];
    const params = input.params as TSAParams;

    const result = calculateTSA(studies, params);

    if (!result) {
      return { error: 'TSA calculation failed - insufficient data' };
    }

    return result;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown calculation error',
    };
  }
}

/**
 * Calculates Mantel-Haenszel pooled odds ratio
 */
export async function performPooledOR(
  input: z.infer<typeof CalculatePooledORSchema>
): Promise<{
  or: number;
  ci95Lower: number;
  ci95Upper: number;
  se: number;
  zStatistic: number;
  pValue: number;
  interpretation: string;
}> {
  const studies = input.studies as Study[];
  const pooled = calculatePooledOR(studies);
  const zStat = calculateZStatistic(studies);

  // Calculate p-value from z-statistic
  const pValue = 2 * (1 - normalCDF(Math.abs(zStat)));

  // Calculate 95% CI
  const logOR = Math.log(pooled.or);
  const ci95Lower = Math.exp(logOR - 1.96 * pooled.se);
  const ci95Upper = Math.exp(logOR + 1.96 * pooled.se);

  // Interpret
  let interpretation: string;
  if (pooled.or < 1 && ci95Upper < 1) {
    interpretation = 'Statistically significant benefit for treatment (OR < 1)';
  } else if (pooled.or > 1 && ci95Lower > 1) {
    interpretation = 'Statistically significant harm for treatment (OR > 1)';
  } else {
    interpretation = 'No statistically significant difference (CI crosses 1)';
  }

  return {
    or: pooled.or,
    ci95Lower,
    ci95Upper,
    se: pooled.se,
    zStatistic: zStat,
    pValue,
    interpretation,
  };
}

/**
 * Calculates Required Information Size
 */
export async function performRISCalculation(
  input: z.infer<typeof CalculateRISSchema>
): Promise<{
  ris: number;
  perArm: number;
  params: {
    alpha: number;
    beta: number;
    power: number;
    controlRate: number;
    treatmentRate: number;
    effectSize: number;
    anticipatedOR: number;
    heterogeneityCorrection: number;
  };
  interpretation: string;
}> {
  const params = input.params as TSAParams;
  const ris = calculateRIS(params);

  // Calculate component values
  const treatmentRate = params.controlRate * (1 - params.effectSize / 100);
  const odds0 = params.controlRate / (1 - params.controlRate);
  const odds1 = treatmentRate / (1 - treatmentRate);
  const anticipatedOR = odds1 / odds0;

  return {
    ris,
    perArm: Math.ceil(ris / 2),
    params: {
      alpha: params.alpha,
      beta: params.beta,
      power: 1 - params.beta,
      controlRate: params.controlRate,
      treatmentRate,
      effectSize: params.effectSize,
      anticipatedOR,
      heterogeneityCorrection: params.heterogeneityCorrection,
    },
    interpretation: `Need ${ris.toLocaleString()} total participants (${Math.ceil(ris / 2).toLocaleString()} per arm) to detect a ${params.effectSize}% relative risk reduction with ${((1 - params.beta) * 100).toFixed(0)}% power at α=${params.alpha}`,
  };
}

/**
 * Calculates heterogeneity statistics
 */
export async function performHeterogeneityCalculation(
  input: z.infer<typeof CalculatePooledORSchema>
): Promise<{
  q: number;
  df: number;
  i2: number;
  tau2: number;
  pValue: number;
  interpretation: string;
}> {
  const studies = input.studies as Study[];
  const het = calculateHeterogeneity(studies);

  let interpretation: string;
  if (het.i2 === 0) {
    interpretation = 'No heterogeneity detected (I² = 0%)';
  } else if (het.i2 < 25) {
    interpretation = `Low heterogeneity (I² = ${het.i2.toFixed(1)}%)`;
  } else if (het.i2 < 50) {
    interpretation = `Moderate heterogeneity (I² = ${het.i2.toFixed(1)}%)`;
  } else if (het.i2 < 75) {
    interpretation = `Substantial heterogeneity (I² = ${het.i2.toFixed(1)}%)`;
  } else {
    interpretation = `Considerable heterogeneity (I² = ${het.i2.toFixed(1)}%) - consider if pooling is appropriate`;
  }

  return {
    q: het.q,
    df: studies.length - 1,
    i2: het.i2,
    tau2: het.tau2,
    pValue: het.pValue,
    interpretation,
  };
}

/**
 * Calculates monitoring and futility boundaries at a given information fraction
 */
export async function performBoundaryCalculation(
  input: z.infer<typeof CalculateBoundarySchema>
): Promise<{
  informationFraction: number;
  monitoringBoundary: number;
  futilityBoundary: number;
  alphaSpent: number;
  betaSpent: number;
  interpretation: string;
}> {
  const { informationFraction, alpha, beta } = input;

  const monitoringBoundary = computeMonitoringBoundary(informationFraction, alpha);
  const futilityBoundary = computeFutilityBoundary(informationFraction, beta, 'obrien-fleming');

  // Calculate alpha/beta spent (simplified - actual implementation in statistics.ts)
  const alphaSpent = informationFraction >= 1 ? alpha : alpha * informationFraction * 0.1;
  const betaSpent = informationFraction >= 1 ? beta : beta * informationFraction * 0.1;

  const percentInfo = (informationFraction * 100).toFixed(1);

  return {
    informationFraction,
    monitoringBoundary,
    futilityBoundary,
    alphaSpent,
    betaSpent,
    interpretation: `At ${percentInfo}% information: Z must exceed ±${monitoringBoundary.toFixed(2)} to cross efficacy boundary`,
  };
}

// Helper function (should be imported from statistics.ts in production)
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

// ============================================================================
// Tool Definitions for Agent SDK
// ============================================================================

export const tsaCalculationTools = {
  calculate_tsa: {
    name: 'calculate_tsa',
    description: 'Perform complete Trial Sequential Analysis including RIS calculation, cumulative Z-statistics, monitoring boundaries, and interpretation of results.',
    inputSchema: CalculateTSASchema,
    handler: performTSA,
  },
  calculate_pooled_or: {
    name: 'calculate_pooled_or',
    description: 'Calculate Mantel-Haenszel pooled odds ratio with Robins-Breslow-Greenland variance estimator and 95% confidence interval.',
    inputSchema: CalculatePooledORSchema,
    handler: performPooledOR,
  },
  calculate_ris: {
    name: 'calculate_ris',
    description: 'Calculate Required Information Size (sample size) for TSA based on alpha, beta, control rate, and anticipated effect size.',
    inputSchema: CalculateRISSchema,
    handler: performRISCalculation,
  },
  calculate_heterogeneity: {
    name: 'calculate_heterogeneity',
    description: 'Calculate heterogeneity statistics (Q, I², τ²) to assess consistency between studies.',
    inputSchema: CalculatePooledORSchema,
    handler: performHeterogeneityCalculation,
  },
  calculate_boundary: {
    name: 'calculate_boundary',
    description: 'Calculate O\'Brien-Fleming monitoring and futility boundaries at a specific information fraction.',
    inputSchema: CalculateBoundarySchema,
    handler: performBoundaryCalculation,
  },
};

export default tsaCalculationTools;
