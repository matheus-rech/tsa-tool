/**
 * TSA Agents Index
 *
 * Exports all agents and the orchestrator for TSA analysis.
 */

import { Study, TSAParams, TSAResults } from '@/types';
import { AgentBond, QualityReport } from './AgentBond';
import { Agent007, FullAnalysisReport } from './Agent007';
import { ScreenshotReporter, ReportWithScreenshots } from './ScreenshotReporter';

// Re-export agents
export { AgentBond, type QualityReport } from './AgentBond';
export { Agent007, type FullAnalysisReport } from './Agent007';
export { ScreenshotReporter, type ReportWithScreenshots, type ComparisonReport } from './ScreenshotReporter';

// ============================================================================
// Types
// ============================================================================

export interface OrchestratorConfig {
  apiKey?: string;
  model?: string;
  verbose?: boolean;
  appUrl?: string;
}

export interface FullPipelineResult {
  timestamp: string;
  qualityReport: QualityReport;
  analysisReport: FullAnalysisReport;
  visualReport: ReportWithScreenshots;
  success: boolean;
  errors: string[];
}

export class QualityError extends Error {
  public report: QualityReport;

  constructor(report: QualityReport) {
    super(`Quality check failed: ${report.overallSummary}`);
    this.name = 'QualityError';
    this.report = report;
  }
}

// ============================================================================
// TSA Agent Orchestrator
// ============================================================================

/**
 * Orchestrates all TSA agents for complete analysis pipeline
 */
export class TSAAgentOrchestrator {
  private bond: AgentBond;
  private agent007: Agent007;
  private reporter: ScreenshotReporter;
  private verbose: boolean;

  constructor(config: OrchestratorConfig = {}) {
    this.verbose = config.verbose || false;

    this.bond = new AgentBond({
      apiKey: config.apiKey,
      model: config.model,
      verbose: this.verbose,
    });

    this.agent007 = new Agent007({
      apiKey: config.apiKey,
      model: config.model,
      verbose: this.verbose,
    });

    this.reporter = new ScreenshotReporter(
      {},
      config.appUrl || 'http://localhost:4173'
    );
  }

  /**
   * Run the full TSA analysis pipeline
   */
  async runFullAnalysis(
    studies: Study[],
    params: TSAParams,
    options: {
      datasetIndex?: number;
      skipQuality?: boolean;
      skipVisual?: boolean;
    } = {}
  ): Promise<FullPipelineResult> {
    const timestamp = new Date().toISOString();
    const errors: string[] = [];

    if (this.verbose) {
      console.log('\n' + '='.repeat(60));
      console.log('TSA AGENT ORCHESTRATOR - FULL PIPELINE');
      console.log('='.repeat(60));
      console.log(`Started: ${timestamp}`);
      console.log(`Studies: ${studies.length}`);
      console.log(`Parameters: α=${params.alpha}, β=${params.beta}, RRR=${params.effectSize}%`);
      console.log('='.repeat(60) + '\n');
    }

    // Step 1: Quality Check with Agent-Bond
    let qualityReport: QualityReport;
    if (!options.skipQuality) {
      if (this.verbose) {
        console.log('\n🔍 PHASE 1: Quality Check (Agent-Bond)');
        console.log('-'.repeat(40));
      }

      qualityReport = await this.bond.qualityCheck(studies, params);

      if (this.verbose) {
        console.log(`Status: ${qualityReport.passed ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Summary: ${qualityReport.overallSummary}`);
      }

      if (!qualityReport.passed) {
        if (this.verbose) {
          console.log('\n⚠️ Quality check failed. Pipeline stopping.');
          qualityReport.recommendations.forEach((r, i) => {
            console.log(`  ${i + 1}. ${r}`);
          });
        }
        throw new QualityError(qualityReport);
      }
    } else {
      // Create minimal quality report when skipped
      qualityReport = {
        passed: true,
        timestamp,
        dataValidation: { isValid: true, issues: [], studiesChecked: studies.length, summary: 'Skipped' },
        methodologyValidation: { isValid: true, issues: [], copenhagenCompliant: true, summary: 'Skipped' },
        heterogeneityAssessment: {
          q: 0, i2: 0, tau2: 0, pValue: 1,
          interpretation: 'Skipped',
          recommendedCorrection: 1,
          currentCorrection: params.heterogeneityCorrection,
          isAdequate: true,
          summary: 'Quality check skipped',
        },
        outlierAnalysis: { hasOutliers: false, outlierCount: 0, summary: 'Skipped' },
        duplicateCheck: { hasDuplicates: false, duplicateCount: 0, summary: 'Skipped' },
        overallSummary: 'Quality check skipped',
        recommendations: [],
      };
    }

    // Step 2: TSA Analysis with Agent-007
    if (this.verbose) {
      console.log('\n🎯 PHASE 2: TSA Analysis (Agent-007)');
      console.log('-'.repeat(40));
    }

    const analysisReport = await this.agent007.fullWorkflow(studies, params);

    if (!analysisReport) {
      errors.push('TSA analysis failed');
      throw new Error('TSA analysis failed');
    }

    if (this.verbose) {
      console.log(`Conclusion: ${analysisReport.tsaResults.interpretation.title}`);
      console.log(`OR: ${analysisReport.tsaResults.pooledOR.toFixed(2)} [${analysisReport.tsaResults.ci95Lower.toFixed(2)}, ${analysisReport.tsaResults.ci95Upper.toFixed(2)}]`);
      console.log(`Information: ${(analysisReport.tsaResults.informationFraction * 100).toFixed(1)}%`);
      console.log(`Confidence: ${analysisReport.interpretation.confidenceLevel.toUpperCase()}`);
    }

    // Step 3: Visual Report with Screenshot Reporter
    let visualReport: ReportWithScreenshots;
    if (!options.skipVisual) {
      if (this.verbose) {
        console.log('\n📸 PHASE 3: Visual Report (Screenshot Reporter)');
        console.log('-'.repeat(40));
      }

      try {
        visualReport = await this.reporter.generateVisualReport(
          analysisReport.tsaResults,
          options.datasetIndex || 0
        );

        if (this.verbose) {
          console.log('Screenshots captured successfully');
        }
      } catch (error) {
        errors.push(`Screenshot capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        if (this.verbose) {
          console.log(`⚠️ Screenshot capture failed: ${error instanceof Error ? error.message : 'Unknown'}`);
        }
        // Create placeholder
        visualReport = {
          timestamp,
          chartScreenshot: Buffer.from(''),
          fullPageScreenshot: Buffer.from(''),
          results: analysisReport.tsaResults,
          summaryText: 'Visual report unavailable',
        };
      } finally {
        await this.reporter.close();
      }
    } else {
      visualReport = {
        timestamp,
        chartScreenshot: Buffer.from(''),
        fullPageScreenshot: Buffer.from(''),
        results: analysisReport.tsaResults,
        summaryText: 'Visual report skipped',
      };
    }

    // Final summary
    if (this.verbose) {
      console.log('\n' + '='.repeat(60));
      console.log('PIPELINE COMPLETE');
      console.log('='.repeat(60));
      console.log(`Main conclusion: ${analysisReport.interpretation.mainConclusion}`);
      console.log(`Clinical significance: ${analysisReport.interpretation.clinicalSignificance}`);
      console.log(`Confidence level: ${analysisReport.interpretation.confidenceLevel}`);
      if (analysisReport.interpretation.caveats.length > 0) {
        console.log('Caveats:');
        analysisReport.interpretation.caveats.forEach(c => console.log(`  - ${c}`));
      }
      console.log('='.repeat(60) + '\n');
    }

    return {
      timestamp,
      qualityReport,
      analysisReport,
      visualReport,
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Quick analysis without full pipeline
   */
  async quickAnalysis(
    studies: Study[],
    params: TSAParams
  ): Promise<TSAResults | null> {
    return this.agent007.analyze(studies, params);
  }

  /**
   * Quality check only
   */
  async qualityCheckOnly(
    studies: Study[],
    params: TSAParams
  ): Promise<QualityReport> {
    return this.bond.qualityCheck(studies, params);
  }

  /**
   * Interactive chat with orchestrator choosing appropriate agent
   */
  async chat(
    message: string,
    context?: {
      studies?: Study[];
      params?: TSAParams;
      results?: TSAResults;
    }
  ): Promise<{ agent: string; response: string }> {
    const lowerMessage = message.toLowerCase();

    // Route to appropriate agent based on message content
    if (
      lowerMessage.includes('quality') ||
      lowerMessage.includes('validate') ||
      lowerMessage.includes('check') ||
      lowerMessage.includes('methodology') ||
      lowerMessage.includes('copenhagen') ||
      lowerMessage.includes('new study') ||
      lowerMessage.includes('update')
    ) {
      const response = await this.bond.chat(message, {
        studies: context?.studies,
        params: context?.params,
      });
      return { agent: 'Agent-Bond', response };
    }

    // Default to Agent-007 for analysis questions
    const response = await this.agent007.chat(message, {
      studies: context?.studies,
      params: context?.params,
      previousResults: context?.results,
    });
    return { agent: 'Agent-007', response };
  }
}

export default TSAAgentOrchestrator;
