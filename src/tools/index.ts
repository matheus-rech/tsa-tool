/**
 * TSA Agent Tools Index
 *
 * Exports all tools for use by TSA agents.
 */

import { z } from 'zod';

// Import all tools from their respective modules
import {
  dataValidationTools,
  validateStudyData,
  detectOutliers,
  checkDuplicates,
  ValidateStudyDataSchema,
  DetectOutliersSchema,
} from './dataValidation';
import type {
  ValidationIssue,
  ValidationResult,
  OutlierResult,
  OutlierAnalysis,
} from './dataValidation';

import {
  methodologyTools,
  validateTSAParams,
  checkCopenhagenAlignment,
  assessHeterogeneity,
  ValidateTSAParamsSchema,
  AssessHeterogeneitySchema,
} from './methodologyCheck';
import type {
  MethodologyIssue,
  MethodologyValidation,
  HeterogeneityAssessment,
} from './methodologyCheck';

import {
  livingReviewTools,
  checkReanalysisNeed,
  generateUpdateAlert,
  simulateNewStudyImpact,
  CheckReanalysisNeedSchema,
  GenerateUpdateAlertSchema,
  SimulateNewStudyImpactSchema,
} from './livingReview';
import type {
  ReanalysisAssessment,
  UpdateAlert,
  ImpactSimulation,
} from './livingReview';

import {
  tsaCalculationTools,
  performTSA,
  performPooledOR,
  performRISCalculation,
  performHeterogeneityCalculation,
  performBoundaryCalculation,
  CalculateTSASchema,
  CalculatePooledORSchema,
  CalculateRISSchema,
  CalculateBoundarySchema,
} from './tsaCalculation';

import {
  sensitivityAnalysisTools,
  leaveOneOut,
  parameterSweep,
  influenceAnalysis,
  LeaveOneOutSchema,
  ParameterSweepSchema,
  InfluenceAnalysisSchema,
} from './sensitivityAnalysis';
import type {
  LeaveOneOutResult,
  LeaveOneOutAnalysis,
  ParameterSweepResult,
  ParameterSweepAnalysis,
  StudyInfluence,
  InfluenceAnalysis as InfluenceAnalysisResult,
} from './sensitivityAnalysis';

// ============================================================================
// Re-exports
// ============================================================================

// Data Validation Tools (Agent-Bond)
export {
  dataValidationTools,
  validateStudyData,
  detectOutliers,
  checkDuplicates,
  ValidateStudyDataSchema,
  DetectOutliersSchema,
};
export type {
  ValidationIssue,
  ValidationResult,
  OutlierResult,
  OutlierAnalysis,
};

// Methodology Check Tools (Agent-Bond)
export {
  methodologyTools,
  validateTSAParams,
  checkCopenhagenAlignment,
  assessHeterogeneity,
  ValidateTSAParamsSchema,
  AssessHeterogeneitySchema,
};
export type {
  MethodologyIssue,
  MethodologyValidation,
  HeterogeneityAssessment,
};

// Living Review Tools (Agent-Bond)
export {
  livingReviewTools,
  checkReanalysisNeed,
  generateUpdateAlert,
  simulateNewStudyImpact,
  CheckReanalysisNeedSchema,
  GenerateUpdateAlertSchema,
  SimulateNewStudyImpactSchema,
};
export type {
  ReanalysisAssessment,
  UpdateAlert,
  ImpactSimulation,
};

// TSA Calculation Tools (Agent-007)
export {
  tsaCalculationTools,
  performTSA,
  performPooledOR,
  performRISCalculation,
  performHeterogeneityCalculation,
  performBoundaryCalculation,
  CalculateTSASchema,
  CalculatePooledORSchema,
  CalculateRISSchema,
  CalculateBoundarySchema,
};

// Sensitivity Analysis Tools (Agent-007)
export {
  sensitivityAnalysisTools,
  leaveOneOut,
  parameterSweep,
  influenceAnalysis,
  LeaveOneOutSchema,
  ParameterSweepSchema,
  InfluenceAnalysisSchema,
};
export type {
  LeaveOneOutResult,
  LeaveOneOutAnalysis,
  ParameterSweepResult,
  ParameterSweepAnalysis,
  StudyInfluence,
  InfluenceAnalysisResult,
};

// ============================================================================
// Combined Tool Collections
// ============================================================================

/**
 * All tools for Agent-Bond (Quality & Monitoring)
 */
export const agentBondTools = {
  ...dataValidationTools,
  ...methodologyTools,
  ...livingReviewTools,
};

/**
 * All tools for Agent-007 (Primary Analysis)
 */
export const agent007Tools = {
  ...tsaCalculationTools,
  ...sensitivityAnalysisTools,
};

/**
 * All available tools
 */
export const allTools = {
  ...agentBondTools,
  ...agent007Tools,
};

// ============================================================================
// Tool Registration Helper
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (input: any) => Promise<any>;
}

/**
 * Converts tool definitions to Anthropic SDK format
 */
export function toAnthropicTools(tools: Record<string, ToolDefinition>): Array<{
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}> {
  return Object.values(tools).map(tool => {
    // Extract JSON schema from Zod schema
    const zodSchema = tool.inputSchema;
    const shape = (zodSchema as z.ZodObject<Record<string, z.ZodType>>)._def?.shape?.() ?? {};

    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodType = value as z.ZodType;
      properties[key] = zodToJsonSchema(zodType);

      // Check if required (not optional)
      if (!(zodType instanceof z.ZodOptional) && !(zodType instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object' as const,
        properties,
        required,
      },
    };
  });
}

/**
 * Simple Zod to JSON Schema converter
 */
function zodToJsonSchema(zodType: z.ZodType): Record<string, unknown> {
  if (zodType instanceof z.ZodString) {
    return { type: 'string' };
  }
  if (zodType instanceof z.ZodNumber) {
    return { type: 'number' };
  }
  if (zodType instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }
  if (zodType instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodToJsonSchema(zodType._def.type),
    };
  }
  if (zodType instanceof z.ZodObject) {
    const shape = zodType._def.shape();
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodType);
    }
    return {
      type: 'object',
      properties,
    };
  }
  if (zodType instanceof z.ZodOptional) {
    return zodToJsonSchema(zodType._def.innerType);
  }
  if (zodType instanceof z.ZodDefault) {
    return zodToJsonSchema(zodType._def.innerType);
  }
  if (zodType instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: zodType._def.values,
    };
  }

  // Default fallback
  return { type: 'string' };
}

export default allTools;
