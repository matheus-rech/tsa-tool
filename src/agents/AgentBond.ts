/**
 * Agent-Bond: Quality & Monitoring Agent
 *
 * Specialized agent for TSA quality assurance:
 * 1. Data Quality Checker - Validates study data for errors
 * 2. Methodology Validator - Ensures Copenhagen methodology compliance
 * 3. Living Review Monitor - Tracks new studies for re-analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import { Study, TSAParams } from '@/types';
import {
  agentBondTools,
  toAnthropicTools,
  validateStudyData,
  detectOutliers,
  checkDuplicates,
  validateTSAParams,
  checkCopenhagenAlignment,
  assessHeterogeneity,
  checkReanalysisNeed,
  generateUpdateAlert,
  simulateNewStudyImpact,
  type ValidationResult,
  type MethodologyValidation,
  type HeterogeneityAssessment,
  type ReanalysisAssessment,
} from '@/tools';

// ============================================================================
// Types
// ============================================================================

export interface QualityReport {
  passed: boolean;
  timestamp: string;
  dataValidation: ValidationResult;
  methodologyValidation: MethodologyValidation;
  heterogeneityAssessment: HeterogeneityAssessment;
  outlierAnalysis: {
    hasOutliers: boolean;
    outlierCount: number;
    summary: string;
  };
  duplicateCheck: {
    hasDuplicates: boolean;
    duplicateCount: number;
    summary: string;
  };
  overallSummary: string;
  recommendations: string[];
}

export interface AgentBondConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  verbose?: boolean;
}

// ============================================================================
// Agent-Bond Implementation
// ============================================================================

export class AgentBond {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private verbose: boolean;

  // System prompt defining Agent-Bond's personality and responsibilities
  private systemPrompt = `You are Agent-Bond, a meticulous quality assurance specialist for Trial Sequential Analysis (TSA).

Your mission is to ensure the highest standards of data quality and methodological rigor. You have three core responsibilities:

1. DATA QUALITY CHECKER
   - Validate study data structure and values
   - Detect outliers in effect sizes
   - Identify potential duplicate studies
   - Flag impossible values (events > totals, future years, etc.)

2. METHODOLOGY VALIDATOR
   - Verify TSA parameters align with Copenhagen Trial Unit standards
   - Check implementation of Lan-DeMets alpha-spending
   - Validate Mantel-Haenszel pooling with Robins-Breslow-Greenland variance
   - Assess heterogeneity and recommend corrections

3. LIVING REVIEW MONITOR
   - Evaluate if new studies warrant re-analysis
   - Calculate impact on Z-score and pooled OR
   - Determine if conclusions might change
   - Generate update alerts for stakeholders

OPERATING PRINCIPLES:
- Be thorough and systematic - check everything
- Be constructive - provide specific recommendations for issues
- Be clear - explain findings in accessible language
- Be vigilant - even small issues can affect validity

When you find issues:
- Classify severity (error, warning, info)
- Explain the impact on TSA validity
- Recommend specific corrective actions

You have access to specialized tools. Use them systematically.`;

  constructor(config: AgentBondConfig = {}) {
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 4096;
    this.verbose = config.verbose || false;
  }

  /**
   * Performs comprehensive quality check on TSA data and parameters
   */
  async qualityCheck(
    studies: Study[],
    params: TSAParams
  ): Promise<QualityReport> {
    const timestamp = new Date().toISOString();

    if (this.verbose) {
      console.log(`[Agent-Bond] Starting quality check at ${timestamp}`);
      console.log(`[Agent-Bond] Checking ${studies.length} studies`);
    }

    // Step 1: Data Validation
    const dataValidation = await validateStudyData({ studies });

    if (this.verbose) {
      console.log(`[Agent-Bond] Data validation: ${dataValidation.summary}`);
    }

    // Step 2: Methodology Validation
    const methodologyValidation = await validateTSAParams(params);

    if (this.verbose) {
      console.log(`[Agent-Bond] Methodology validation: ${methodologyValidation.summary}`);
    }

    // Step 3: Heterogeneity Assessment
    const heterogeneityAssessment = await assessHeterogeneity({
      studies,
      params,
    });

    if (this.verbose) {
      console.log(`[Agent-Bond] Heterogeneity: ${heterogeneityAssessment.summary}`);
    }

    // Step 4: Outlier Detection
    const outlierResult = await detectOutliers({ studies, threshold: 2 });
    const outlierAnalysis = {
      hasOutliers: outlierResult.outliers.some(o => o.isOutlier),
      outlierCount: outlierResult.outliers.filter(o => o.isOutlier).length,
      summary: outlierResult.summary,
    };

    if (this.verbose) {
      console.log(`[Agent-Bond] Outliers: ${outlierAnalysis.summary}`);
    }

    // Step 5: Duplicate Check
    const duplicateResult = await checkDuplicates({ studies });
    const duplicateCheck = {
      hasDuplicates: duplicateResult.duplicates.length > 0,
      duplicateCount: duplicateResult.duplicates.length,
      summary: duplicateResult.summary,
    };

    if (this.verbose) {
      console.log(`[Agent-Bond] Duplicates: ${duplicateCheck.summary}`);
    }

    // Compile recommendations
    const recommendations: string[] = [];

    if (!dataValidation.isValid) {
      recommendations.push('Fix data validation errors before proceeding with TSA');
    }
    if (!methodologyValidation.isValid) {
      recommendations.push('Correct TSA parameter issues for valid analysis');
    }
    if (!methodologyValidation.copenhagenCompliant) {
      recommendations.push('Consider using standard Copenhagen TSA parameters (α=0.05, β=0.10 or 0.20)');
    }
    if (!heterogeneityAssessment.isAdequate) {
      recommendations.push(`Increase heterogeneity correction to ${heterogeneityAssessment.recommendedCorrection}`);
    }
    if (outlierAnalysis.hasOutliers) {
      recommendations.push('Investigate outlier studies and consider sensitivity analysis');
    }
    if (duplicateCheck.hasDuplicates) {
      recommendations.push('Review potential duplicate studies to avoid double-counting');
    }

    // Determine overall pass/fail
    const passed =
      dataValidation.isValid &&
      methodologyValidation.isValid &&
      !duplicateCheck.hasDuplicates;

    // Generate overall summary
    const issues = [
      dataValidation.issues.filter(i => i.severity === 'error').length,
      methodologyValidation.issues.filter(i => i.severity === 'error').length,
    ].reduce((a, b) => a + b, 0);

    const warnings = [
      dataValidation.issues.filter(i => i.severity === 'warning').length,
      methodologyValidation.issues.filter(i => i.severity === 'warning').length,
      outlierAnalysis.hasOutliers ? 1 : 0,
    ].reduce((a, b) => a + b, 0);

    const overallSummary = passed
      ? warnings > 0
        ? `Quality check PASSED with ${warnings} warning(s). ${recommendations.length} recommendation(s) provided.`
        : 'Quality check PASSED. Data and methodology are valid.'
      : `Quality check FAILED. ${issues} error(s) found. Please address issues before proceeding.`;

    return {
      passed,
      timestamp,
      dataValidation,
      methodologyValidation,
      heterogeneityAssessment,
      outlierAnalysis,
      duplicateCheck,
      overallSummary,
      recommendations,
    };
  }

  /**
   * Checks if a new study warrants re-analysis
   */
  async checkNewStudyImpact(
    currentStudies: Study[],
    newStudy: Study,
    params: TSAParams,
    currentInterpretation: 'conclusive-benefit' | 'conclusive-harm' | 'futility' | 'inconclusive'
  ): Promise<ReanalysisAssessment> {
    if (this.verbose) {
      console.log(`[Agent-Bond] Checking impact of new study: ${newStudy.name}`);
    }

    return checkReanalysisNeed({
      currentStudies,
      newStudy,
      params,
      currentInterpretation,
    });
  }

  /**
   * Interactive chat session with Agent-Bond
   */
  async chat(userMessage: string, context?: {
    studies?: Study[];
    params?: TSAParams;
  }): Promise<string> {
    // Build context message
    let contextMessage = '';
    if (context?.studies) {
      contextMessage += `\n\nCurrent studies (${context.studies.length}):\n`;
      contextMessage += JSON.stringify(context.studies, null, 2);
    }
    if (context?.params) {
      contextMessage += `\n\nTSA Parameters:\n`;
      contextMessage += JSON.stringify(context.params, null, 2);
    }

    const fullMessage = userMessage + contextMessage;

    // Prepare tools
    const tools = toAnthropicTools(agentBondTools);

    // Create message
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: this.systemPrompt,
      tools,
      messages: [
        { role: 'user', content: fullMessage },
      ],
    });

    // Process response
    let textResponse = '';
    const toolResults: Array<{ name: string; result: unknown }> = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textResponse += block.text;
      } else if (block.type === 'tool_use') {
        // Execute tool
        const result = await this.executeTool(block.name, block.input);
        toolResults.push({ name: block.name, result });

        if (this.verbose) {
          console.log(`[Agent-Bond] Used tool: ${block.name}`);
        }
      }
    }

    // If tools were used, continue the conversation with results
    if (toolResults.length > 0 && response.stop_reason === 'tool_use') {
      const toolResultMessages = toolResults.map(tr => {
        const toolBlock = response.content.find(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === tr.name
        );
        return {
          type: 'tool_result' as const,
          tool_use_id: toolBlock?.id ?? '',
          content: JSON.stringify(tr.result),
        };
      });

      const followUp = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: this.systemPrompt,
        messages: [
          { role: 'user', content: fullMessage },
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResultMessages },
        ],
      });

      for (const block of followUp.content) {
        if (block.type === 'text') {
          textResponse += block.text;
        }
      }
    }

    return textResponse;
  }

  /**
   * Interactive session for CLI usage
   */
  async interactiveSession(): Promise<void> {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('\n🔍 Agent-Bond Quality Assurance System');
    console.log('━'.repeat(50));
    console.log('I am Agent-Bond, your TSA quality specialist.');
    console.log('Ask me to validate data, check methodology, or monitor for updates.');
    console.log('Type "exit" to end the session.\n');

    const askQuestion = (): void => {
      rl.question('You: ', async (input) => {
        const trimmed = input.trim();

        if (trimmed.toLowerCase() === 'exit') {
          console.log('\n[Agent-Bond] Mission complete. Stay vigilant.');
          rl.close();
          return;
        }

        try {
          const response = await this.chat(trimmed);
          console.log(`\nAgent-Bond: ${response}\n`);
        } catch (error) {
          console.error(`\n[Error] ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        }

        askQuestion();
      });
    };

    askQuestion();
  }

  /**
   * Execute a tool by name
   */
  private async executeTool(name: string, input: unknown): Promise<unknown> {
    const handlers: Record<string, (input: unknown) => Promise<unknown>> = {
      validate_study_data: (i) => validateStudyData(i as Parameters<typeof validateStudyData>[0]),
      detect_outliers: (i) => detectOutliers(i as Parameters<typeof detectOutliers>[0]),
      check_duplicates: (i) => checkDuplicates(i as Parameters<typeof checkDuplicates>[0]),
      validate_tsa_params: (i) => validateTSAParams(i as Parameters<typeof validateTSAParams>[0]),
      check_copenhagen_alignment: (i) => checkCopenhagenAlignment(i as Parameters<typeof checkCopenhagenAlignment>[0]),
      assess_heterogeneity: (i) => assessHeterogeneity(i as Parameters<typeof assessHeterogeneity>[0]),
      check_reanalysis_need: (i) => checkReanalysisNeed(i as Parameters<typeof checkReanalysisNeed>[0]),
      generate_update_alert: (i) => generateUpdateAlert(i as Parameters<typeof generateUpdateAlert>[0]),
      simulate_new_study_impact: (i) => simulateNewStudyImpact(i as Parameters<typeof simulateNewStudyImpact>[0]),
    };

    const handler = handlers[name];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    return handler(input);
  }
}

export default AgentBond;
