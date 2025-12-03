/**
 * Living Review Monitoring Tools for Agent-Bond
 *
 * Tools for monitoring new studies and determining if re-analysis is needed.
 */

import { z } from 'zod';
import { Study, TSAParams } from '@/types';
import { calculateTSA, calculatePooledOR, calculateZStatistic } from '@/lib/statistics';

// ============================================================================
// Zod Schemas
// ============================================================================

export const CheckReanalysisNeedSchema = z.object({
  currentStudies: z.array(z.object({
    id: z.string(),
    name: z.string(),
    year: z.number(),
    eventsTrt: z.number(),
    totalTrt: z.number(),
    eventsCtrl: z.number(),
    totalCtrl: z.number(),
  })),
  newStudy: z.object({
    id: z.string(),
    name: z.string(),
    year: z.number(),
    eventsTrt: z.number(),
    totalTrt: z.number(),
    eventsCtrl: z.number(),
    totalCtrl: z.number(),
  }),
  params: z.object({
    alpha: z.number(),
    beta: z.number(),
    controlRate: z.number(),
    effectSize: z.number(),
    heterogeneityCorrection: z.number().optional(),
  }),
  currentInterpretation: z.enum(['conclusive-benefit', 'conclusive-harm', 'futility', 'inconclusive']),
});

export const GenerateUpdateAlertSchema = z.object({
  topic: z.string(),
  newStudyCount: z.number(),
  impactAssessment: z.enum(['high', 'medium', 'low']),
  currentConclusion: z.string(),
  recommendedAction: z.string(),
});

export const SimulateNewStudyImpactSchema = z.object({
  currentStudies: z.array(z.object({
    id: z.string(),
    name: z.string(),
    year: z.number(),
    eventsTrt: z.number(),
    totalTrt: z.number(),
    eventsCtrl: z.number(),
    totalCtrl: z.number(),
  })),
  hypotheticalStudy: z.object({
    totalN: z.number().min(10),
    eventRateTrt: z.number().min(0).max(1),
    eventRateCtrl: z.number().min(0).max(1),
  }),
  params: z.object({
    alpha: z.number(),
    beta: z.number(),
    controlRate: z.number(),
    effectSize: z.number(),
    heterogeneityCorrection: z.number().optional(),
  }),
});

// ============================================================================
// Types
// ============================================================================

export interface ReanalysisAssessment {
  needsReanalysis: boolean;
  impactLevel: 'high' | 'medium' | 'low' | 'none';
  currentZ: number;
  projectedZ: number;
  zChange: number;
  currentOR: number;
  projectedOR: number;
  conclusionMayChange: boolean;
  summary: string;
  recommendation: string;
}

export interface UpdateAlert {
  id: string;
  timestamp: string;
  topic: string;
  severity: 'critical' | 'important' | 'routine';
  title: string;
  message: string;
  action: string;
}

export interface ImpactSimulation {
  hypotheticalStudy: {
    nTrt: number;
    nCtrl: number;
    eventsTrt: number;
    eventsCtrl: number;
    or: number;
  };
  beforeZ: number;
  afterZ: number;
  zChange: number;
  beforeOR: number;
  afterOR: number;
  orChange: number;
  conclusionChange: string;
  summary: string;
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Determines if re-analysis is needed after a new study is published
 */
export async function checkReanalysisNeed(
  input: z.infer<typeof CheckReanalysisNeedSchema>
): Promise<ReanalysisAssessment> {
  const currentStudies = input.currentStudies as Study[];
  const newStudy = input.newStudy as Study;
  const params = input.params as TSAParams;

  // Calculate current statistics
  const currentPooled = calculatePooledOR(currentStudies);
  const currentZ = calculateZStatistic(currentStudies);

  // Calculate with new study added
  const updatedStudies = [...currentStudies, newStudy];
  const projectedPooled = calculatePooledOR(updatedStudies);
  const projectedZ = calculateZStatistic(updatedStudies);

  // Calculate changes
  const zChange = projectedZ - currentZ;
  const orChange = (projectedPooled.or - currentPooled.or) / currentPooled.or;

  // Determine impact level
  let impactLevel: 'high' | 'medium' | 'low' | 'none';
  if (Math.abs(zChange) > 0.5) {
    impactLevel = 'high';
  } else if (Math.abs(zChange) > 0.2) {
    impactLevel = 'medium';
  } else if (Math.abs(zChange) > 0.05) {
    impactLevel = 'low';
  } else {
    impactLevel = 'none';
  }

  // Check if conclusion might change
  const currentResults = calculateTSA(currentStudies, params);
  const projectedResults = calculateTSA(updatedStudies, params);

  const conclusionMayChange =
    currentResults !== null &&
    projectedResults !== null &&
    currentResults.interpretation.type !== projectedResults.interpretation.type;

  // Determine if re-analysis is needed
  const needsReanalysis =
    impactLevel === 'high' ||
    conclusionMayChange ||
    (input.currentInterpretation === 'inconclusive' && impactLevel !== 'none');

  // Generate recommendation
  let recommendation: string;
  if (conclusionMayChange) {
    recommendation = 'URGENT: New study may change the TSA conclusion. Re-analysis required.';
  } else if (impactLevel === 'high') {
    recommendation = 'High impact study detected. Re-analysis recommended.';
  } else if (needsReanalysis) {
    recommendation = 'Re-analysis recommended to update evidence synthesis.';
  } else {
    recommendation = 'No immediate re-analysis needed. Consider routine update.';
  }

  return {
    needsReanalysis,
    impactLevel,
    currentZ,
    projectedZ,
    zChange,
    currentOR: currentPooled.or,
    projectedOR: projectedPooled.or,
    conclusionMayChange,
    summary: `New study "${newStudy.name}" (n=${newStudy.totalTrt + newStudy.totalCtrl}): Z-score change = ${zChange >= 0 ? '+' : ''}${zChange.toFixed(3)}, OR change = ${(orChange * 100).toFixed(1)}%`,
    recommendation,
  };
}

/**
 * Generates an update alert for stakeholders
 */
export async function generateUpdateAlert(
  input: z.infer<typeof GenerateUpdateAlertSchema>
): Promise<UpdateAlert> {
  const { topic, newStudyCount, impactAssessment, currentConclusion, recommendedAction } = input;

  // Determine severity
  let severity: 'critical' | 'important' | 'routine';
  if (impactAssessment === 'high') {
    severity = 'critical';
  } else if (impactAssessment === 'medium') {
    severity = 'important';
  } else {
    severity = 'routine';
  }

  // Generate title
  let title: string;
  if (severity === 'critical') {
    title = `CRITICAL: ${newStudyCount} new ${newStudyCount === 1 ? 'study' : 'studies'} may change TSA conclusion`;
  } else if (severity === 'important') {
    title = `Important: ${newStudyCount} new ${newStudyCount === 1 ? 'study' : 'studies'} identified for ${topic}`;
  } else {
    title = `Routine update: ${newStudyCount} new ${newStudyCount === 1 ? 'study' : 'studies'} for ${topic}`;
  }

  // Generate message
  const message = `Living review monitoring has identified ${newStudyCount} new ${newStudyCount === 1 ? 'study' : 'studies'} relevant to "${topic}".

Current conclusion: ${currentConclusion}
Impact assessment: ${impactAssessment.toUpperCase()}
Recommended action: ${recommendedAction}`;

  return {
    id: `alert-${Date.now()}`,
    timestamp: new Date().toISOString(),
    topic,
    severity,
    title,
    message,
    action: recommendedAction,
  };
}

/**
 * Simulates the impact of a hypothetical new study
 */
export async function simulateNewStudyImpact(
  input: z.infer<typeof SimulateNewStudyImpactSchema>
): Promise<ImpactSimulation> {
  const currentStudies = input.currentStudies as Study[];
  const { hypotheticalStudy, params } = input;

  // Create hypothetical study
  const nPerArm = Math.floor(hypotheticalStudy.totalN / 2);
  const eventsTrt = Math.round(nPerArm * hypotheticalStudy.eventRateTrt);
  const eventsCtrl = Math.round(nPerArm * hypotheticalStudy.eventRateCtrl);

  const newStudy: Study = {
    id: 'hypothetical',
    name: 'Hypothetical Study',
    year: new Date().getFullYear(),
    eventsTrt,
    totalTrt: nPerArm,
    eventsCtrl,
    totalCtrl: nPerArm,
  };

  // Calculate before statistics
  const beforePooled = calculatePooledOR(currentStudies);
  const beforeZ = calculateZStatistic(currentStudies);

  // Calculate after statistics
  const afterStudies = [...currentStudies, newStudy];
  const afterPooled = calculatePooledOR(afterStudies);
  const afterZ = calculateZStatistic(afterStudies);

  // Calculate hypothetical study OR
  const a = eventsTrt;
  const b = nPerArm - eventsTrt;
  const c = eventsCtrl;
  const d = nPerArm - eventsCtrl;
  const hypotheticalOR = (a * d) / (b * c) || 1;

  // Determine conclusion change
  const beforeTSA = calculateTSA(currentStudies, params as TSAParams);
  const afterTSA = calculateTSA(afterStudies, params as TSAParams);

  let conclusionChange: string;
  if (beforeTSA && afterTSA) {
    if (beforeTSA.interpretation.type === afterTSA.interpretation.type) {
      conclusionChange = 'No change in conclusion';
    } else {
      conclusionChange = `Conclusion changes from "${beforeTSA.interpretation.type}" to "${afterTSA.interpretation.type}"`;
    }
  } else {
    conclusionChange = 'Unable to determine';
  }

  return {
    hypotheticalStudy: {
      nTrt: nPerArm,
      nCtrl: nPerArm,
      eventsTrt,
      eventsCtrl,
      or: hypotheticalOR,
    },
    beforeZ,
    afterZ,
    zChange: afterZ - beforeZ,
    beforeOR: beforePooled.or,
    afterOR: afterPooled.or,
    orChange: ((afterPooled.or - beforePooled.or) / beforePooled.or) * 100,
    conclusionChange,
    summary: `Adding hypothetical study (n=${hypotheticalStudy.totalN}, OR=${hypotheticalOR.toFixed(2)}): Z ${beforeZ >= 0 ? '+' : ''}${beforeZ.toFixed(2)} → ${afterZ >= 0 ? '+' : ''}${afterZ.toFixed(2)}`,
  };
}

// ============================================================================
// Tool Definitions for Agent SDK
// ============================================================================

export const livingReviewTools = {
  check_reanalysis_need: {
    name: 'check_reanalysis_need',
    description: 'Determine if a new published study warrants re-analysis of the TSA. Calculates impact on Z-score, OR, and whether the conclusion might change.',
    inputSchema: CheckReanalysisNeedSchema,
    handler: checkReanalysisNeed,
  },
  generate_update_alert: {
    name: 'generate_update_alert',
    description: 'Generate a formatted alert notification for stakeholders about new studies requiring attention.',
    inputSchema: GenerateUpdateAlertSchema,
    handler: generateUpdateAlert,
  },
  simulate_new_study_impact: {
    name: 'simulate_new_study_impact',
    description: 'Simulate the impact of a hypothetical new study on the TSA results. Useful for power analysis and planning.',
    inputSchema: SimulateNewStudyImpactSchema,
    handler: simulateNewStudyImpact,
  },
};

export default livingReviewTools;
