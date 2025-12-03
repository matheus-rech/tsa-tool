/**
 * Data Validation Tools for Agent-Bond
 *
 * Validates study data for quality issues, inconsistencies, and errors.
 */

import { z } from 'zod';
import { Study } from '@/types';
import { calculateStudyOR } from '@/lib/statistics';

// ============================================================================
// Zod Schemas for Tool Inputs
// ============================================================================

export const ValidateStudyDataSchema = z.object({
  studies: z.array(z.object({
    id: z.string(),
    name: z.string(),
    year: z.number(),
    eventsTrt: z.number(),
    totalTrt: z.number(),
    eventsCtrl: z.number(),
    totalCtrl: z.number(),
  })),
});

export const DetectOutliersSchema = z.object({
  studies: z.array(z.object({
    id: z.string(),
    name: z.string(),
    year: z.number(),
    eventsTrt: z.number(),
    totalTrt: z.number(),
    eventsCtrl: z.number(),
    totalCtrl: z.number(),
  })),
  threshold: z.number().min(1).max(5).default(2), // Number of SDs for outlier
});

// ============================================================================
// Types
// ============================================================================

export interface ValidationIssue {
  studyId: string;
  studyName: string;
  field: string;
  issue: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  studiesChecked: number;
  summary: string;
}

export interface OutlierResult {
  studyId: string;
  studyName: string;
  logOR: number;
  zScore: number;
  isOutlier: boolean;
  direction: 'favors-treatment' | 'favors-control' | 'neutral';
}

export interface OutlierAnalysis {
  outliers: OutlierResult[];
  pooledLogOR: number;
  sdLogOR: number;
  threshold: number;
  summary: string;
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Validates study data structure and values
 */
export async function validateStudyData(
  input: z.infer<typeof ValidateStudyDataSchema>
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  const currentYear = new Date().getFullYear();

  for (const study of input.studies) {
    // Check for negative values
    if (study.eventsTrt < 0) {
      issues.push({
        studyId: study.id,
        studyName: study.name,
        field: 'eventsTrt',
        issue: 'Treatment events cannot be negative',
        severity: 'error',
      });
    }
    if (study.eventsCtrl < 0) {
      issues.push({
        studyId: study.id,
        studyName: study.name,
        field: 'eventsCtrl',
        issue: 'Control events cannot be negative',
        severity: 'error',
      });
    }
    if (study.totalTrt <= 0) {
      issues.push({
        studyId: study.id,
        studyName: study.name,
        field: 'totalTrt',
        issue: 'Treatment group size must be positive',
        severity: 'error',
      });
    }
    if (study.totalCtrl <= 0) {
      issues.push({
        studyId: study.id,
        studyName: study.name,
        field: 'totalCtrl',
        issue: 'Control group size must be positive',
        severity: 'error',
      });
    }

    // Check events don't exceed totals
    if (study.eventsTrt > study.totalTrt) {
      issues.push({
        studyId: study.id,
        studyName: study.name,
        field: 'eventsTrt',
        issue: `Events (${study.eventsTrt}) exceed total participants (${study.totalTrt})`,
        severity: 'error',
      });
    }
    if (study.eventsCtrl > study.totalCtrl) {
      issues.push({
        studyId: study.id,
        studyName: study.name,
        field: 'eventsCtrl',
        issue: `Events (${study.eventsCtrl}) exceed total participants (${study.totalCtrl})`,
        severity: 'error',
      });
    }

    // Check year plausibility
    if (study.year > currentYear) {
      issues.push({
        studyId: study.id,
        studyName: study.name,
        field: 'year',
        issue: `Study year (${study.year}) is in the future`,
        severity: 'error',
      });
    }
    if (study.year < 1900) {
      issues.push({
        studyId: study.id,
        studyName: study.name,
        field: 'year',
        issue: `Study year (${study.year}) is unrealistically old`,
        severity: 'warning',
      });
    }

    // Check for very small sample sizes
    const totalN = study.totalTrt + study.totalCtrl;
    if (totalN < 20) {
      issues.push({
        studyId: study.id,
        studyName: study.name,
        field: 'totalN',
        issue: `Very small sample size (n=${totalN}) - results may be unreliable`,
        severity: 'warning',
      });
    }

    // Check for double-zero studies
    if (study.eventsTrt === 0 && study.eventsCtrl === 0) {
      issues.push({
        studyId: study.id,
        studyName: study.name,
        field: 'events',
        issue: 'No events in either group - study provides no information for OR',
        severity: 'warning',
      });
    }

    // Check for 100% event rates
    if (study.eventsTrt === study.totalTrt && study.eventsCtrl === study.totalCtrl) {
      issues.push({
        studyId: study.id,
        studyName: study.name,
        field: 'events',
        issue: 'All participants had events in both groups',
        severity: 'warning',
      });
    }

    // Check for empty study name
    if (!study.name || study.name.trim() === '') {
      issues.push({
        studyId: study.id,
        studyName: study.name || '(empty)',
        field: 'name',
        issue: 'Study name is empty',
        severity: 'info',
      });
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  return {
    isValid: errorCount === 0,
    issues,
    studiesChecked: input.studies.length,
    summary: errorCount === 0
      ? warningCount > 0
        ? `Data valid with ${warningCount} warning(s)`
        : 'All data validated successfully'
      : `Validation failed: ${errorCount} error(s) found`,
  };
}

/**
 * Detects outlier studies based on log(OR) z-scores
 */
export async function detectOutliers(
  input: z.infer<typeof DetectOutliersSchema>
): Promise<OutlierAnalysis> {
  const studies = input.studies as Study[];
  const threshold = input.threshold;

  // Calculate log(OR) for each study
  const studyORs = studies.map(study => {
    const result = calculateStudyOR(study);
    return {
      study,
      logOR: Math.log(result.or),
      se: result.se,
      weight: result.weight,
    };
  }).filter(s => isFinite(s.logOR) && isFinite(s.se));

  if (studyORs.length < 2) {
    return {
      outliers: [],
      pooledLogOR: studyORs[0]?.logOR ?? 0,
      sdLogOR: 0,
      threshold,
      summary: 'Insufficient studies to detect outliers (need at least 2)',
    };
  }

  // Calculate weighted mean log(OR)
  const totalWeight = studyORs.reduce((sum, s) => sum + s.weight, 0);
  const pooledLogOR = studyORs.reduce((sum, s) => sum + s.logOR * s.weight, 0) / totalWeight;

  // Calculate weighted SD
  const weightedVariance = studyORs.reduce(
    (sum, s) => sum + s.weight * Math.pow(s.logOR - pooledLogOR, 2),
    0
  ) / totalWeight;
  const sdLogOR = Math.sqrt(weightedVariance);

  // Identify outliers
  const outliers: OutlierResult[] = studyORs.map(s => {
    const zScore = sdLogOR > 0 ? (s.logOR - pooledLogOR) / sdLogOR : 0;
    const isOutlier = Math.abs(zScore) > threshold;

    return {
      studyId: s.study.id,
      studyName: s.study.name,
      logOR: s.logOR,
      zScore,
      isOutlier,
      direction: zScore > 0.5 ? 'favors-control' : zScore < -0.5 ? 'favors-treatment' : 'neutral',
    };
  });

  const outlierCount = outliers.filter(o => o.isOutlier).length;

  return {
    outliers,
    pooledLogOR,
    sdLogOR,
    threshold,
    summary: outlierCount === 0
      ? 'No outliers detected'
      : `${outlierCount} outlier(s) detected (|z| > ${threshold})`,
  };
}

/**
 * Checks for duplicate studies based on name similarity
 */
export async function checkDuplicates(
  input: z.infer<typeof ValidateStudyDataSchema>
): Promise<{ duplicates: Array<{ study1: string; study2: string; similarity: number }>; summary: string }> {
  const duplicates: Array<{ study1: string; study2: string; similarity: number }> = [];

  for (let i = 0; i < input.studies.length; i++) {
    for (let j = i + 1; j < input.studies.length; j++) {
      const s1 = input.studies[i];
      const s2 = input.studies[j];

      // Check for exact name match
      if (s1.name.toLowerCase() === s2.name.toLowerCase()) {
        duplicates.push({
          study1: s1.name,
          study2: s2.name,
          similarity: 1.0,
        });
        continue;
      }

      // Check for same year and similar sample sizes (potential duplicate)
      if (
        s1.year === s2.year &&
        Math.abs(s1.totalTrt - s2.totalTrt) < 10 &&
        Math.abs(s1.totalCtrl - s2.totalCtrl) < 10
      ) {
        duplicates.push({
          study1: s1.name,
          study2: s2.name,
          similarity: 0.8,
        });
      }
    }
  }

  return {
    duplicates,
    summary: duplicates.length === 0
      ? 'No duplicate studies detected'
      : `${duplicates.length} potential duplicate(s) found`,
  };
}

// ============================================================================
// Tool Definitions for Agent SDK
// ============================================================================

export const dataValidationTools = {
  validate_study_data: {
    name: 'validate_study_data',
    description: 'Validate study data for errors, inconsistencies, and missing values. Checks event counts, sample sizes, year plausibility, and data integrity.',
    inputSchema: ValidateStudyDataSchema,
    handler: validateStudyData,
  },
  detect_outliers: {
    name: 'detect_outliers',
    description: 'Detect outlier studies based on their effect size (log odds ratio). Returns z-scores and flags studies exceeding the threshold.',
    inputSchema: DetectOutliersSchema,
    handler: detectOutliers,
  },
  check_duplicates: {
    name: 'check_duplicates',
    description: 'Check for potential duplicate studies based on name similarity and matching characteristics.',
    inputSchema: ValidateStudyDataSchema,
    handler: checkDuplicates,
  },
};

export default dataValidationTools;
