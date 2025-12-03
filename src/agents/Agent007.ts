/**
 * Agent-007: Primary TSA Analysis Agent
 *
 * Specialized agent for conducting Trial Sequential Analysis:
 * 1. TSA Calculator - Performs complete TSA analysis
 * 2. Sensitivity Analysis - Tests robustness of results
 * 3. Power Analysis - Calculates required sample sizes
 * 4. Results Interpreter - Provides clinical significance assessment
 * 5. Report Generator - Creates publication-quality reports
 */

import Anthropic from '@anthropic-ai/sdk';
import { Study, TSAParams, TSAResults } from '@/types';
import {
  agent007Tools,
  toAnthropicTools,
  performTSA,
  performPooledOR,
  performRISCalculation,
  performHeterogeneityCalculation,
  performBoundaryCalculation,
  leaveOneOut,
  parameterSweep,
  influenceAnalysis,
  type LeaveOneOutAnalysis,
  type ParameterSweepAnalysis,
  type InfluenceAnalysisResult,
} from '@/tools';

// ============================================================================
// Types
// ============================================================================

export interface FullAnalysisReport {
  timestamp: string;
  studies: {
    count: number;
    totalPatients: number;
    yearRange: string;
  };
  tsaResults: TSAResults;
  sensitivityAnalysis: {
    leaveOneOut: LeaveOneOutAnalysis;
    effectSizeSweep: ParameterSweepAnalysis;
    influenceAnalysis: InfluenceAnalysisResult;
  };
  interpretation: {
    mainConclusion: string;
    clinicalSignificance: string;
    confidenceLevel: 'high' | 'moderate' | 'low';
    caveats: string[];
  };
  recommendations: string[];
}

export interface Agent007Config {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  verbose?: boolean;
}

// ============================================================================
// Agent-007 Implementation
// ============================================================================

export class Agent007 {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private verbose: boolean;

  // System prompt defining Agent-007's personality and responsibilities
  private systemPrompt = `You are Agent-007, an elite Trial Sequential Analysis (TSA) specialist.

Your mission is to conduct rigorous meta-analysis with sequential monitoring. You have a license to analyze.

CORE CAPABILITIES:

1. TSA CALCULATOR
   - Perform complete TSA with Lan-DeMets O'Brien-Fleming boundaries
   - Calculate Required Information Size (RIS)
   - Track cumulative Z-statistics across studies
   - Determine if evidence is conclusive or requires more data

2. SENSITIVITY ANALYST
   - Leave-one-out analysis to test robustness
   - Parameter sensitivity sweeps
   - Influence analysis to identify key studies
   - Subgroup analysis when appropriate

3. POWER ANALYST
   - Calculate sample sizes for different effect sizes
   - Project when RIS might be reached
   - Simulate impact of future studies

4. RESULTS INTERPRETER
   - Translate statistical findings to clinical meaning
   - Assess strength and quality of evidence
   - Identify limitations and biases
   - Provide actionable recommendations

5. REPORT GENERATOR
   - Summarize findings clearly
   - Present key statistics
   - Visualize TSA trajectory (describe for visualization)
   - Document methodology

OPERATING PRINCIPLES:
- Be precise - statistical accuracy is paramount
- Be comprehensive - analyze from multiple angles
- Be clear - translate statistics into plain language
- Be honest - acknowledge uncertainty and limitations

When presenting results:
- Start with the main finding
- Support with key statistics (OR, CI, Z-score, information fraction)
- Explain clinical relevance
- Note sensitivity analysis findings
- Provide clear recommendations

You have access to specialized analysis tools. Use them strategically.`;

  constructor(config: Agent007Config = {}) {
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 4096;
    this.verbose = config.verbose || false;
  }

  /**
   * Performs TSA analysis on study data
   */
  async analyze(
    studies: Study[],
    params: TSAParams
  ): Promise<TSAResults | null> {
    if (this.verbose) {
      console.log(`[Agent-007] Initiating TSA analysis...`);
      console.log(`[Agent-007] Studies: ${studies.length}`);
      console.log(`[Agent-007] Parameters: α=${params.alpha}, β=${params.beta}, RRR=${params.effectSize}%`);
    }

    const result = await performTSA({ studies, params });

    if ('error' in result) {
      if (this.verbose) {
        console.log(`[Agent-007] Analysis failed: ${result.error}`);
      }
      return null;
    }

    if (this.verbose) {
      console.log(`[Agent-007] Analysis complete.`);
      console.log(`[Agent-007] Conclusion: ${result.interpretation.title}`);
      console.log(`[Agent-007] Pooled OR: ${result.pooledOR.toFixed(2)} [${result.ci95Lower.toFixed(2)}, ${result.ci95Upper.toFixed(2)}]`);
      console.log(`[Agent-007] Information: ${(result.informationFraction * 100).toFixed(1)}% of RIS`);
    }

    return result;
  }

  /**
   * Performs comprehensive analysis with sensitivity testing
   */
  async fullWorkflow(
    studies: Study[],
    params: TSAParams
  ): Promise<FullAnalysisReport | null> {
    const timestamp = new Date().toISOString();

    if (this.verbose) {
      console.log(`[Agent-007] Starting full analysis workflow...`);
    }

    // Step 1: Primary TSA
    const tsaResult = await performTSA({ studies, params });
    if ('error' in tsaResult) {
      console.error(`[Agent-007] TSA failed: ${tsaResult.error}`);
      return null;
    }
    const tsaResults = tsaResult as TSAResults;

    if (this.verbose) {
      console.log(`[Agent-007] Primary TSA complete: ${tsaResults.interpretation.title}`);
    }

    // Step 2: Leave-one-out sensitivity
    const loo = await leaveOneOut({ studies, params });

    if (this.verbose) {
      console.log(`[Agent-007] Leave-one-out: ${loo.summary}`);
    }

    // Step 3: Effect size sensitivity sweep
    const effectSizes = [15, 20, 25, 30, 35, 40, 50];
    const effectSweep = await parameterSweep({
      studies,
      baseParams: params,
      sweepParameter: 'effectSize',
      values: effectSizes,
    });

    if (this.verbose) {
      console.log(`[Agent-007] Effect size sweep: ${effectSweep.summary}`);
    }

    // Step 4: Influence analysis
    const influence = await influenceAnalysis({ studies });

    if (this.verbose) {
      console.log(`[Agent-007] Influence: ${influence.summary}`);
    }

    // Step 5: Generate interpretation
    const interpretation = this.generateInterpretation(tsaResults, loo, effectSweep, influence);

    // Step 6: Generate recommendations
    const recommendations = this.generateRecommendations(tsaResults, loo, effectSweep);

    // Compile study info
    const years = studies.map(s => s.year);
    const studyInfo = {
      count: studies.length,
      totalPatients: studies.reduce((sum, s) => sum + s.totalTrt + s.totalCtrl, 0),
      yearRange: `${Math.min(...years)}-${Math.max(...years)}`,
    };

    return {
      timestamp,
      studies: studyInfo,
      tsaResults,
      sensitivityAnalysis: {
        leaveOneOut: loo,
        effectSizeSweep: effectSweep,
        influenceAnalysis: influence,
      },
      interpretation,
      recommendations,
    };
  }

  /**
   * Calculates power/sample size for different scenarios
   */
  async powerAnalysis(
    params: TSAParams,
    effectSizes: number[] = [15, 20, 25, 30, 40, 50]
  ): Promise<Array<{
    effectSize: number;
    ris: number;
    perArm: number;
    anticipatedOR: number;
  }>> {
    const results = await Promise.all(
      effectSizes.map(async (effectSize) => {
        const result = await performRISCalculation({
          params: { ...params, effectSize },
        });
        return {
          effectSize,
          ris: result.ris,
          perArm: result.perArm,
          anticipatedOR: result.params.anticipatedOR,
        };
      })
    );

    if (this.verbose) {
      console.log(`[Agent-007] Power analysis complete:`);
      results.forEach(r => {
        console.log(`  RRR ${r.effectSize}%: RIS = ${r.ris.toLocaleString()} (OR = ${r.anticipatedOR.toFixed(2)})`);
      });
    }

    return results;
  }

  /**
   * Interactive chat session with Agent-007
   */
  async chat(userMessage: string, context?: {
    studies?: Study[];
    params?: TSAParams;
    previousResults?: TSAResults;
  }): Promise<string> {
    // Build context message
    let contextMessage = '';
    if (context?.studies) {
      contextMessage += `\n\nStudies (${context.studies.length} total, ${context.studies.reduce((s, st) => s + st.totalTrt + st.totalCtrl, 0)} patients):\n`;
      contextMessage += JSON.stringify(context.studies.slice(0, 5), null, 2);
      if (context.studies.length > 5) {
        contextMessage += `\n... and ${context.studies.length - 5} more studies`;
      }
    }
    if (context?.params) {
      contextMessage += `\n\nTSA Parameters: α=${context.params.alpha}, β=${context.params.beta}, control rate=${context.params.controlRate}, RRR=${context.params.effectSize}%`;
    }
    if (context?.previousResults) {
      contextMessage += `\n\nPrevious TSA Results:\n`;
      contextMessage += `- Conclusion: ${context.previousResults.interpretation.title}\n`;
      contextMessage += `- Pooled OR: ${context.previousResults.pooledOR.toFixed(2)} [${context.previousResults.ci95Lower.toFixed(2)}, ${context.previousResults.ci95Upper.toFixed(2)}]\n`;
      contextMessage += `- Information: ${(context.previousResults.informationFraction * 100).toFixed(1)}% of RIS (${context.previousResults.ris.toLocaleString()})`;
    }

    const fullMessage = userMessage + contextMessage;

    // Prepare tools
    const tools = toAnthropicTools(agent007Tools);

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
    const toolResults: Array<{ name: string; id: string; result: unknown }> = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textResponse += block.text;
      } else if (block.type === 'tool_use') {
        const result = await this.executeTool(block.name, block.input);
        toolResults.push({ name: block.name, id: block.id, result });

        if (this.verbose) {
          console.log(`[Agent-007] Used tool: ${block.name}`);
        }
      }
    }

    // If tools were used, continue the conversation
    if (toolResults.length > 0 && response.stop_reason === 'tool_use') {
      const toolResultMessages = toolResults.map(tr => ({
        type: 'tool_result' as const,
        tool_use_id: tr.id,
        content: JSON.stringify(tr.result),
      }));

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

    console.log('\n🎯 Agent-007 TSA Analysis System');
    console.log('━'.repeat(50));
    console.log('The name is 007. Agent-007. TSA specialist.');
    console.log('I analyze meta-analysis data with a license to conclude.');
    console.log('Type "exit" to end the session.\n');

    const askQuestion = (): void => {
      rl.question('You: ', async (input) => {
        const trimmed = input.trim();

        if (trimmed.toLowerCase() === 'exit') {
          console.log('\n[Agent-007] Mission accomplished. The data speaks for itself.');
          rl.close();
          return;
        }

        try {
          const response = await this.chat(trimmed);
          console.log(`\nAgent-007: ${response}\n`);
        } catch (error) {
          console.error(`\n[Error] ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        }

        askQuestion();
      });
    };

    askQuestion();
  }

  /**
   * Generate clinical interpretation
   */
  private generateInterpretation(
    tsa: TSAResults,
    loo: LeaveOneOutAnalysis,
    effectSweep: ParameterSweepAnalysis,
    _influence: InfluenceAnalysisResult
  ): FullAnalysisReport['interpretation'] {
    // Determine main conclusion
    let mainConclusion: string;
    switch (tsa.interpretation.type) {
      case 'conclusive-benefit':
        mainConclusion = `The TSA shows conclusive evidence of benefit for the treatment (OR = ${tsa.pooledOR.toFixed(2)}, 95% CI: ${tsa.ci95Lower.toFixed(2)}-${tsa.ci95Upper.toFixed(2)}).`;
        break;
      case 'conclusive-harm':
        mainConclusion = `The TSA shows conclusive evidence of harm for the treatment (OR = ${tsa.pooledOR.toFixed(2)}, 95% CI: ${tsa.ci95Lower.toFixed(2)}-${tsa.ci95Upper.toFixed(2)}).`;
        break;
      case 'futility':
        mainConclusion = `The TSA indicates futility - treatments are likely similar with no clinically meaningful difference.`;
        break;
      default:
        mainConclusion = `The evidence is inconclusive. Current information represents ${(tsa.informationFraction * 100).toFixed(0)}% of the required sample size.`;
    }

    // Determine clinical significance
    let clinicalSignificance: string;
    const orDeviation = Math.abs(tsa.pooledOR - 1);
    if (orDeviation < 0.1) {
      clinicalSignificance = 'Minimal clinical effect observed.';
    } else if (orDeviation < 0.3) {
      clinicalSignificance = 'Small but potentially meaningful clinical effect.';
    } else if (orDeviation < 0.5) {
      clinicalSignificance = 'Moderate clinical effect observed.';
    } else {
      clinicalSignificance = 'Large clinical effect observed.';
    }

    // Determine confidence level
    let confidenceLevel: 'high' | 'moderate' | 'low';
    if (loo.conclusionRobust && effectSweep.sensitivity === 'low') {
      confidenceLevel = 'high';
    } else if (loo.conclusionRobust || effectSweep.sensitivity === 'low') {
      confidenceLevel = 'moderate';
    } else {
      confidenceLevel = 'low';
    }

    // Identify caveats
    const caveats: string[] = [];
    if (!loo.conclusionRobust) {
      caveats.push(`Conclusion changes when excluding "${loo.mostInfluential}"`);
    }
    if (effectSweep.sensitivity !== 'low') {
      caveats.push('Results are sensitive to assumed effect size');
    }
    if (tsa.heterogeneity.i2 > 50) {
      caveats.push(`Substantial heterogeneity (I² = ${tsa.heterogeneity.i2.toFixed(0)}%)`);
    }
    if (tsa.informationFraction < 0.5) {
      caveats.push('Less than half the required information has accrued');
    }

    return {
      mainConclusion,
      clinicalSignificance,
      confidenceLevel,
      caveats,
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    tsa: TSAResults,
    loo: LeaveOneOutAnalysis,
    effectSweep: ParameterSweepAnalysis
  ): string[] {
    const recommendations: string[] = [];

    if (tsa.interpretation.type === 'inconclusive') {
      const remaining = tsa.ris - tsa.totalPatients;
      recommendations.push(`Continue accruing data - approximately ${remaining.toLocaleString()} more participants needed`);
    }

    if (!loo.conclusionRobust) {
      recommendations.push('Perform sensitivity analysis excluding influential studies');
    }

    if (tsa.heterogeneity.i2 > 50) {
      recommendations.push('Investigate sources of heterogeneity through subgroup analysis');
    }

    if (effectSweep.sensitivity === 'high') {
      recommendations.push('Consider pre-specifying effect size based on clinical minimally important difference');
    }

    if (tsa.interpretation.type === 'conclusive-benefit' || tsa.interpretation.type === 'conclusive-harm') {
      recommendations.push('Update clinical guidelines based on conclusive evidence');
      recommendations.push('Consider stopping ongoing trials for ethical reasons');
    }

    if (recommendations.length === 0) {
      recommendations.push('Results appear robust - continue monitoring for new evidence');
    }

    return recommendations;
  }

  /**
   * Execute a tool by name
   */
  private async executeTool(name: string, input: unknown): Promise<unknown> {
    const handlers: Record<string, (input: unknown) => Promise<unknown>> = {
      calculate_tsa: (i) => performTSA(i as Parameters<typeof performTSA>[0]),
      calculate_pooled_or: (i) => performPooledOR(i as Parameters<typeof performPooledOR>[0]),
      calculate_ris: (i) => performRISCalculation(i as Parameters<typeof performRISCalculation>[0]),
      calculate_heterogeneity: (i) => performHeterogeneityCalculation(i as Parameters<typeof performHeterogeneityCalculation>[0]),
      calculate_boundary: (i) => performBoundaryCalculation(i as Parameters<typeof performBoundaryCalculation>[0]),
      leave_one_out: (i) => leaveOneOut(i as Parameters<typeof leaveOneOut>[0]),
      parameter_sweep: (i) => parameterSweep(i as Parameters<typeof parameterSweep>[0]),
      influence_analysis: (i) => influenceAnalysis(i as Parameters<typeof influenceAnalysis>[0]),
    };

    const handler = handlers[name];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    return handler(input);
  }
}

export default Agent007;
