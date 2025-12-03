/**
 * Sensitivity Analysis Tools for Agent-007
 *
 * Tools for testing robustness of TSA results across parameter variations.
 */

import { z } from 'zod';
import { Study, TSAParams } from '@/types';
import { calculateTSA, calculatePooledOR, calculateZStatistic, calculateHeterogeneity } from '@/lib/statistics';

// ============================================================================
// Zod Schemas
// ============================================================================

const StudySchema = z.object({
  id: z.string(),
  name: z.string(),
  year: z.number(),
  eventsTrt: z.number(),
  totalTrt: z.number(),
  eventsCtrl: z.number(),
  totalCtrl: z.number(),
});

const ParamsSchema = z.object({
  alpha: z.number(),
  beta: z.number(),
  controlRate: z.number(),
  effectSize: z.number(),
  heterogeneityCorrection: z.number().optional(),
});

export const LeaveOneOutSchema = z.object({
  studies: z.array(StudySchema).min(2),
  params: ParamsSchema,
});

export const ParameterSweepSchema = z.object({
  studies: z.array(StudySchema).min(1),
  baseParams: ParamsSchema,
  sweepParameter: z.enum(['effectSize', 'controlRate', 'alpha', 'beta', 'heterogeneityCorrection']),
  values: z.array(z.number()).min(2),
});

export const InfluenceAnalysisSchema = z.object({
  studies: z.array(StudySchema).min(2),
});

// ============================================================================
// Types
// ============================================================================

export interface LeaveOneOutResult {
  excludedStudy: string;
  remainingStudies: number;
  or: number;
  ci95Lower: number;
  ci95Upper: number;
  zStatistic: number;
  interpretation: string;
  changeFromFull: {
    orPercent: number;
    zAbsolute: number;
  };
}

export interface LeaveOneOutAnalysis {
  fullAnalysis: {
    or: number;
    zStatistic: number;
    interpretation: string;
  };
  results: LeaveOneOutResult[];
  mostInfluential: string;
  conclusionRobust: boolean;
  summary: string;
}

export interface ParameterSweepResult {
  parameterValue: number;
  ris: number;
  informationFraction: number;
  interpretation: string;
}

export interface ParameterSweepAnalysis {
  parameter: string;
  values: number[];
  results: ParameterSweepResult[];
  sensitivity: 'high' | 'medium' | 'low';
  summary: string;
}

export interface StudyInfluence {
  studyId: string;
  studyName: string;
  sampleSize: number;
  weight: number;
  or: number;
  influence: number;
  direction: 'favors-treatment' | 'favors-control' | 'neutral';
}

export interface InfluenceAnalysis {
  studies: StudyInfluence[];
  mostInfluential: StudyInfluence;
  leastInfluential: StudyInfluence;
  summary: string;
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Performs leave-one-out sensitivity analysis
 */
export async function leaveOneOut(
  input: z.infer<typeof LeaveOneOutSchema>
): Promise<LeaveOneOutAnalysis> {
  const studies = input.studies as Study[];
  const params = input.params as TSAParams;

  // Calculate full analysis
  const fullPooled = calculatePooledOR(studies);
  const fullZ = calculateZStatistic(studies);
  const fullTSA = calculateTSA(studies, params);
  const fullInterpretation = fullTSA?.interpretation.type ?? 'inconclusive';

  const results: LeaveOneOutResult[] = [];
  let maxZChange = 0;
  let mostInfluentialStudy = '';

  for (let i = 0; i < studies.length; i++) {
    const excludedStudy = studies[i];
    const remainingStudies = studies.filter((_, idx) => idx !== i);

    const pooled = calculatePooledOR(remainingStudies);
    const zStat = calculateZStatistic(remainingStudies);
    const tsa = calculateTSA(remainingStudies, params);

    const logOR = Math.log(pooled.or);
    const ci95Lower = Math.exp(logOR - 1.96 * pooled.se);
    const ci95Upper = Math.exp(logOR + 1.96 * pooled.se);

    const orChangePercent = ((pooled.or - fullPooled.or) / fullPooled.or) * 100;
    const zChange = zStat - fullZ;

    if (Math.abs(zChange) > Math.abs(maxZChange)) {
      maxZChange = zChange;
      mostInfluentialStudy = excludedStudy.name;
    }

    results.push({
      excludedStudy: excludedStudy.name,
      remainingStudies: remainingStudies.length,
      or: pooled.or,
      ci95Lower,
      ci95Upper,
      zStatistic: zStat,
      interpretation: tsa?.interpretation.type ?? 'inconclusive',
      changeFromFull: {
        orPercent: orChangePercent,
        zAbsolute: zChange,
      },
    });
  }

  // Check if conclusion is robust
  const conclusionChanges = results.filter(r => r.interpretation !== fullInterpretation);
  const conclusionRobust = conclusionChanges.length === 0;

  return {
    fullAnalysis: {
      or: fullPooled.or,
      zStatistic: fullZ,
      interpretation: fullInterpretation,
    },
    results,
    mostInfluential: mostInfluentialStudy,
    conclusionRobust,
    summary: conclusionRobust
      ? `Conclusion is robust: remains "${fullInterpretation}" when excluding any single study`
      : `Conclusion is sensitive: changes when excluding ${conclusionChanges.length} study(ies)`,
  };
}

/**
 * Performs parameter sweep sensitivity analysis
 */
export async function parameterSweep(
  input: z.infer<typeof ParameterSweepSchema>
): Promise<ParameterSweepAnalysis> {
  const studies = input.studies as Study[];
  const { baseParams, sweepParameter, values } = input;

  const results: ParameterSweepResult[] = [];
  const interpretations: string[] = [];

  for (const value of values) {
    const params = { ...baseParams, [sweepParameter]: value } as TSAParams;
    const tsa = calculateTSA(studies, params);

    if (tsa) {
      results.push({
        parameterValue: value,
        ris: tsa.ris,
        informationFraction: tsa.informationFraction,
        interpretation: tsa.interpretation.type,
      });
      interpretations.push(tsa.interpretation.type);
    }
  }

  // Determine sensitivity level
  const uniqueInterpretations = new Set(interpretations);
  let sensitivity: 'high' | 'medium' | 'low';
  if (uniqueInterpretations.size > 2) {
    sensitivity = 'high';
  } else if (uniqueInterpretations.size > 1) {
    sensitivity = 'medium';
  } else {
    sensitivity = 'low';
  }

  // Calculate RIS range
  const risValues = results.map(r => r.ris);
  const risMin = Math.min(...risValues);
  const risMax = Math.max(...risValues);
  const risRange = ((risMax - risMin) / risMin) * 100;

  return {
    parameter: sweepParameter,
    values,
    results,
    sensitivity,
    summary: `${sweepParameter} sensitivity: ${sensitivity.toUpperCase()}. RIS ranges from ${risMin.toLocaleString()} to ${risMax.toLocaleString()} (${risRange.toFixed(0)}% variation)`,
  };
}

/**
 * Analyzes individual study influence on pooled results
 */
export async function influenceAnalysis(
  input: z.infer<typeof InfluenceAnalysisSchema>
): Promise<InfluenceAnalysis> {
  const studies = input.studies as Study[];

  // Calculate pooled OR and weights
  const pooledOR = calculatePooledOR(studies);
  const logPooledOR = Math.log(pooledOR.or);

  // Calculate individual study statistics
  const studyStats: StudyInfluence[] = studies.map(study => {
    const a = study.eventsTrt;
    const b = study.totalTrt - study.eventsTrt;
    const c = study.eventsCtrl;
    const d = study.totalCtrl - study.eventsCtrl;

    // Apply continuity correction if needed
    let a2 = a, b2 = b, c2 = c, d2 = d;
    if (a === 0 || b === 0 || c === 0 || d === 0) {
      a2 += 0.5; b2 += 0.5; c2 += 0.5; d2 += 0.5;
    }

    const or = (a2 * d2) / (b2 * c2);
    const se = Math.sqrt(1/a2 + 1/b2 + 1/c2 + 1/d2);
    const weight = 1 / (se * se);
    const logOR = Math.log(or);

    // Influence = weight × distance from pooled OR
    const influence = weight * Math.abs(logOR - logPooledOR);

    // Direction
    let direction: 'favors-treatment' | 'favors-control' | 'neutral';
    if (or < 0.9) {
      direction = 'favors-treatment';
    } else if (or > 1.1) {
      direction = 'favors-control';
    } else {
      direction = 'neutral';
    }

    return {
      studyId: study.id,
      studyName: study.name,
      sampleSize: study.totalTrt + study.totalCtrl,
      weight,
      or,
      influence,
      direction,
    };
  });

  // Sort by influence
  const sortedByInfluence = [...studyStats].sort((a, b) => b.influence - a.influence);

  // Normalize weights to percentages
  const totalWeight = studyStats.reduce((sum, s) => sum + s.weight, 0);
  studyStats.forEach(s => {
    s.weight = (s.weight / totalWeight) * 100;
  });

  const mostInfluential = sortedByInfluence[0];
  const leastInfluential = sortedByInfluence[sortedByInfluence.length - 1];

  return {
    studies: studyStats,
    mostInfluential,
    leastInfluential,
    summary: `Most influential: "${mostInfluential.studyName}" (${mostInfluential.weight.toFixed(1)}% weight, OR=${mostInfluential.or.toFixed(2)}). Least influential: "${leastInfluential.studyName}" (${leastInfluential.weight.toFixed(1)}% weight)`,
  };
}

/**
 * Performs subgroup analysis by study characteristic
 */
export async function subgroupAnalysis(
  studies: Study[],
  groupingFn: (study: Study) => string,
  params: TSAParams
): Promise<{
  subgroups: Array<{
    name: string;
    studies: number;
    or: number;
    ci95Lower: number;
    ci95Upper: number;
    i2: number;
    interpretation: string;
  }>;
  interactionPValue: number | null;
  summary: string;
}> {
  // Group studies
  const groups = new Map<string, Study[]>();
  for (const study of studies) {
    const groupName = groupingFn(study);
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName)!.push(study);
  }

  // Analyze each subgroup
  const subgroups: Array<{
    name: string;
    studies: number;
    or: number;
    ci95Lower: number;
    ci95Upper: number;
    i2: number;
    interpretation: string;
  }> = [];

  for (const [name, groupStudies] of groups) {
    if (groupStudies.length === 0) continue;

    const pooled = calculatePooledOR(groupStudies);
    const het = calculateHeterogeneity(groupStudies);
    const tsa = calculateTSA(groupStudies, params);

    const logOR = Math.log(pooled.or);
    const ci95Lower = Math.exp(logOR - 1.96 * pooled.se);
    const ci95Upper = Math.exp(logOR + 1.96 * pooled.se);

    subgroups.push({
      name,
      studies: groupStudies.length,
      or: pooled.or,
      ci95Lower,
      ci95Upper,
      i2: het.i2,
      interpretation: tsa?.interpretation.type ?? 'inconclusive',
    });
  }

  // Sort by OR
  subgroups.sort((a, b) => a.or - b.or);

  return {
    subgroups,
    interactionPValue: null, // Would require more complex calculation
    summary: `${subgroups.length} subgroups analyzed. OR ranges from ${subgroups[0]?.or.toFixed(2) ?? 'N/A'} to ${subgroups[subgroups.length - 1]?.or.toFixed(2) ?? 'N/A'}`,
  };
}

// ============================================================================
// Tool Definitions for Agent SDK
// ============================================================================

export const sensitivityAnalysisTools = {
  leave_one_out: {
    name: 'leave_one_out',
    description: 'Perform leave-one-out sensitivity analysis by excluding each study iteratively. Identifies influential studies and tests conclusion robustness.',
    inputSchema: LeaveOneOutSchema,
    handler: leaveOneOut,
  },
  parameter_sweep: {
    name: 'parameter_sweep',
    description: 'Vary a TSA parameter across a range of values to assess sensitivity. Tests how conclusions change with different assumptions.',
    inputSchema: ParameterSweepSchema,
    handler: parameterSweep,
  },
  influence_analysis: {
    name: 'influence_analysis',
    description: 'Analyze the influence of each study on the pooled results. Identifies studies that drive the overall effect estimate.',
    inputSchema: InfluenceAnalysisSchema,
    handler: influenceAnalysis,
  },
};

export default sensitivityAnalysisTools;
