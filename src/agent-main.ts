/**
 * TSA-Agent Entry Point
 *
 * Command-line interface for TSA agents.
 *
 * Usage:
 *   npm run agent           # Run orchestrator with default dataset
 *   npm run agent:bond      # Run Agent-Bond interactive session
 *   npm run agent:007       # Run Agent-007 interactive session
 *
 * Flags:
 *   --agent=bond|007|orchestrator  Select agent
 *   --dataset=0|1|2                Select dataset (0=TRA, 1=Hypothermia, 2=COVID)
 *   --verbose                      Enable verbose output
 *   --skip-quality                 Skip quality check
 *   --skip-visual                  Skip screenshot generation
 */

import 'dotenv/config';
import { TSAAgentOrchestrator, AgentBond, Agent007, QualityError } from './agents';
import { exampleDataSets as datasets } from './data';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CLIArgs {
  agent: 'bond' | '007' | 'orchestrator';
  dataset: number;
  verbose: boolean;
  skipQuality: boolean;
  skipVisual: boolean;
  interactive: boolean;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);

  const getArg = (name: string): string | undefined => {
    const arg = args.find(a => a.startsWith(`--${name}=`));
    return arg?.split('=')[1];
  };

  const hasFlag = (name: string): boolean => {
    return args.includes(`--${name}`);
  };

  return {
    agent: (getArg('agent') || 'orchestrator') as CLIArgs['agent'],
    dataset: parseInt(getArg('dataset') || '0', 10),
    verbose: hasFlag('verbose'),
    skipQuality: hasFlag('skip-quality'),
    skipVisual: hasFlag('skip-visual'),
    interactive: hasFlag('interactive') || hasFlag('i'),
  };
}

// ============================================================================
// Main Functions
// ============================================================================

async function runOrchestrator(args: CLIArgs): Promise<void> {
  console.log('\n🚀 TSA-Agent Orchestrator');
  console.log('━'.repeat(50));

  const dataset = datasets[args.dataset];
  if (!dataset) {
    console.error(`Invalid dataset index: ${args.dataset}`);
    console.log('Available datasets:');
    datasets.forEach((d: typeof datasets[0], i: number) => console.log(`  ${i}: ${d.name}`));
    process.exit(1);
  }

  console.log(`Dataset: ${dataset.name}`);
  console.log(`Studies: ${dataset.studies.length}`);
  console.log(`Parameters: α=${dataset.params.alpha}, β=${dataset.params.beta}, RRR=${dataset.params.effectSize}%`);
  console.log('━'.repeat(50) + '\n');

  const orchestrator = new TSAAgentOrchestrator({
    verbose: args.verbose,
  });

  try {
    const result = await orchestrator.runFullAnalysis(
      dataset.studies,
      dataset.params,
      {
        datasetIndex: args.dataset,
        skipQuality: args.skipQuality,
        skipVisual: args.skipVisual,
      }
    );

    // Output final summary
    console.log('\n📊 FINAL RESULTS');
    console.log('━'.repeat(50));
    console.log(`Quality Check: ${result.qualityReport.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Conclusion: ${result.analysisReport.tsaResults.interpretation.title}`);
    console.log(`Pooled OR: ${result.analysisReport.tsaResults.pooledOR.toFixed(3)} [${result.analysisReport.tsaResults.ci95Lower.toFixed(3)}, ${result.analysisReport.tsaResults.ci95Upper.toFixed(3)}]`);
    console.log(`Z-Score: ${result.analysisReport.tsaResults.finalZ.toFixed(3)}`);
    console.log(`Information: ${(result.analysisReport.tsaResults.informationFraction * 100).toFixed(1)}% of RIS (${result.analysisReport.tsaResults.ris.toLocaleString()})`);
    console.log(`I²: ${result.analysisReport.tsaResults.heterogeneity.i2.toFixed(1)}%`);
    console.log('━'.repeat(50));

    console.log('\n📋 INTERPRETATION');
    console.log(result.analysisReport.interpretation.mainConclusion);
    console.log(result.analysisReport.interpretation.clinicalSignificance);
    console.log(`Confidence: ${result.analysisReport.interpretation.confidenceLevel.toUpperCase()}`);

    if (result.analysisReport.interpretation.caveats.length > 0) {
      console.log('\n⚠️ CAVEATS');
      result.analysisReport.interpretation.caveats.forEach(c => console.log(`  • ${c}`));
    }

    if (result.analysisReport.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS');
      result.analysisReport.recommendations.forEach(r => console.log(`  • ${r}`));
    }

    console.log('\n');

  } catch (error) {
    if (error instanceof QualityError) {
      console.error('\n❌ QUALITY CHECK FAILED');
      console.error(error.report.overallSummary);
      console.log('\nIssues found:');
      error.report.dataValidation.issues.forEach(issue => {
        console.log(`  [${issue.severity.toUpperCase()}] ${issue.studyName}: ${issue.issue}`);
      });
      error.report.methodologyValidation.issues.forEach(issue => {
        console.log(`  [${issue.severity.toUpperCase()}] ${issue.parameter}: ${issue.issue}`);
      });
      console.log('\nRecommendations:');
      error.report.recommendations.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
    } else {
      console.error('\n❌ Analysis failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    process.exit(1);
  }
}

async function runAgentBond(args: CLIArgs): Promise<void> {
  const bond = new AgentBond({ verbose: args.verbose });

  if (args.interactive) {
    await bond.interactiveSession();
  } else {
    // Run quality check on selected dataset
    const dataset = datasets[args.dataset];
    if (!dataset) {
      console.error(`Invalid dataset index: ${args.dataset}`);
      process.exit(1);
    }

    console.log(`\n🔍 Running quality check on: ${dataset.name}\n`);
    const report = await bond.qualityCheck(dataset.studies, dataset.params);

    console.log('\n📋 QUALITY REPORT');
    console.log('━'.repeat(50));
    console.log(`Status: ${report.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Data Validation: ${report.dataValidation.summary}`);
    console.log(`Methodology: ${report.methodologyValidation.summary}`);
    console.log(`Heterogeneity: ${report.heterogeneityAssessment.summary}`);
    console.log(`Outliers: ${report.outlierAnalysis.summary}`);
    console.log(`Duplicates: ${report.duplicateCheck.summary}`);
    console.log('━'.repeat(50));
    console.log(`Summary: ${report.overallSummary}`);

    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS');
      report.recommendations.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
    }
    console.log('\n');
  }
}

async function runAgent007(args: CLIArgs): Promise<void> {
  const agent007 = new Agent007({ verbose: args.verbose });

  if (args.interactive) {
    await agent007.interactiveSession();
  } else {
    // Run full analysis on selected dataset
    const dataset = datasets[args.dataset];
    if (!dataset) {
      console.error(`Invalid dataset index: ${args.dataset}`);
      process.exit(1);
    }

    console.log(`\n🎯 Running TSA analysis on: ${dataset.name}\n`);
    const report = await agent007.fullWorkflow(dataset.studies, dataset.params);

    if (!report) {
      console.error('Analysis failed');
      process.exit(1);
    }

    console.log('\n📊 ANALYSIS REPORT');
    console.log('━'.repeat(50));
    console.log(`Studies: ${report.studies.count} (${report.studies.totalPatients.toLocaleString()} patients)`);
    console.log(`Years: ${report.studies.yearRange}`);
    console.log('━'.repeat(50));
    console.log(`Conclusion: ${report.tsaResults.interpretation.title}`);
    console.log(`Pooled OR: ${report.tsaResults.pooledOR.toFixed(3)} [${report.tsaResults.ci95Lower.toFixed(3)}, ${report.tsaResults.ci95Upper.toFixed(3)}]`);
    console.log(`Z-Score: ${report.tsaResults.finalZ.toFixed(3)}`);
    console.log(`RIS: ${report.tsaResults.ris.toLocaleString()} patients`);
    console.log(`Information: ${(report.tsaResults.informationFraction * 100).toFixed(1)}%`);
    console.log(`I²: ${report.tsaResults.heterogeneity.i2.toFixed(1)}%`);
    console.log('━'.repeat(50));

    console.log('\n🔬 SENSITIVITY ANALYSIS');
    console.log(`Leave-one-out: ${report.sensitivityAnalysis.leaveOneOut.summary}`);
    console.log(`Effect size sweep: ${report.sensitivityAnalysis.effectSizeSweep.summary}`);
    console.log(`Influence: ${report.sensitivityAnalysis.influenceAnalysis.summary}`);

    console.log('\n📋 INTERPRETATION');
    console.log(report.interpretation.mainConclusion);
    console.log(report.interpretation.clinicalSignificance);
    console.log(`Confidence: ${report.interpretation.confidenceLevel.toUpperCase()}`);

    if (report.interpretation.caveats.length > 0) {
      console.log('\n⚠️ CAVEATS');
      report.interpretation.caveats.forEach(c => console.log(`  • ${c}`));
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS');
      report.recommendations.forEach(r => console.log(`  • ${r}`));
    }
    console.log('\n');
  }
}

// ============================================================================
// Entry Point
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY environment variable is required');
    console.log('Create a .env file with:');
    console.log('  ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  console.log('\n🤖 TSA-Agent System');
  console.log('━'.repeat(50));
  console.log(`Agent: ${args.agent}`);
  console.log(`Dataset: ${args.dataset} (${datasets[args.dataset]?.name || 'Unknown'})`);
  console.log(`Mode: ${args.interactive ? 'Interactive' : 'Batch'}`);
  console.log('━'.repeat(50));

  switch (args.agent) {
    case 'bond':
      await runAgentBond(args);
      break;
    case '007':
      await runAgent007(args);
      break;
    case 'orchestrator':
    default:
      await runOrchestrator(args);
      break;
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
