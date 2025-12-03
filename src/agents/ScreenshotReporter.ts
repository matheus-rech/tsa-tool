/**
 * Screenshot Reporter Agent
 *
 * Generates visual reports with TSA chart screenshots using Playwright.
 */

import { chromium, Browser } from 'playwright';
import { TSAResults } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ScreenshotConfig {
  width?: number;
  height?: number;
  scale?: number;
  format?: 'png' | 'jpeg';
  quality?: number;
  outputDir?: string;
}

export interface ReportWithScreenshots {
  timestamp: string;
  chartScreenshot: Buffer;
  fullPageScreenshot: Buffer;
  results: TSAResults;
  summaryText: string;
}

export interface ComparisonReport {
  timestamp: string;
  beforeScreenshot: Buffer;
  afterScreenshot: Buffer;
  beforeResults: TSAResults;
  afterResults: TSAResults;
  changes: {
    orChange: number;
    zChange: number;
    infoFractionChange: number;
    conclusionChanged: boolean;
  };
  summaryText: string;
}

// ============================================================================
// Screenshot Reporter Implementation
// ============================================================================

export class ScreenshotReporter {
  private browser: Browser | null = null;
  private config: ScreenshotConfig;
  private appUrl: string;

  constructor(config: ScreenshotConfig = {}, appUrl = 'http://localhost:4173') {
    this.config = {
      width: config.width || 1400,
      height: config.height || 900,
      scale: config.scale || 1,
      format: config.format || 'png',
      quality: config.quality || 90,
      outputDir: config.outputDir || './screenshots',
    };
    this.appUrl = appUrl;
  }

  /**
   * Initialize browser
   */
  async init(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Capture TSA chart screenshot
   */
  async captureChart(datasetIndex = 0): Promise<Buffer> {
    await this.init();

    const page = await this.browser!.newPage({
      viewport: {
        width: this.config.width!,
        height: this.config.height!,
      },
    });

    try {
      // Navigate to app
      await page.goto(this.appUrl);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Wait for canvas rendering

      // Select dataset if needed
      if (datasetIndex > 0) {
        const selector = page.locator('select[aria-label="Select Dataset"]');
        await selector.selectOption({ index: datasetIndex });
        await page.waitForTimeout(500);
      }

      // Capture chart area
      const chartContainer = page.locator('.lg\\:col-span-2').first();
      const screenshot = await chartContainer.screenshot({
        type: this.config.format,
        ...(this.config.format === 'jpeg' && { quality: this.config.quality }),
      });

      return screenshot;
    } finally {
      await page.close();
    }
  }

  /**
   * Capture full page screenshot
   */
  async captureFullPage(datasetIndex = 0): Promise<Buffer> {
    await this.init();

    const page = await this.browser!.newPage({
      viewport: {
        width: this.config.width!,
        height: this.config.height!,
      },
    });

    try {
      await page.goto(this.appUrl);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      if (datasetIndex > 0) {
        const selector = page.locator('select[aria-label="Select Dataset"]');
        await selector.selectOption({ index: datasetIndex });
        await page.waitForTimeout(500);
      }

      const screenshot = await page.screenshot({
        fullPage: true,
        type: this.config.format,
        ...(this.config.format === 'jpeg' && { quality: this.config.quality }),
      });

      return screenshot;
    } finally {
      await page.close();
    }
  }

  /**
   * Generate full visual report
   */
  async generateVisualReport(
    results: TSAResults,
    datasetIndex = 0
  ): Promise<ReportWithScreenshots> {
    const timestamp = new Date().toISOString();

    // Capture screenshots
    const chartScreenshot = await this.captureChart(datasetIndex);
    const fullPageScreenshot = await this.captureFullPage(datasetIndex);

    // Generate summary text
    const summaryText = this.generateSummaryText(results);

    return {
      timestamp,
      chartScreenshot,
      fullPageScreenshot,
      results,
      summaryText,
    };
  }

  /**
   * Create before/after comparison report
   */
  async createComparisonReport(
    beforeResults: TSAResults,
    afterResults: TSAResults,
    beforeDatasetIndex = 0,
    afterDatasetIndex = 0
  ): Promise<ComparisonReport> {
    const timestamp = new Date().toISOString();

    // Capture before screenshot
    const beforeScreenshot = await this.captureFullPage(beforeDatasetIndex);

    // Capture after screenshot
    const afterScreenshot = await this.captureFullPage(afterDatasetIndex);

    // Calculate changes
    const changes = {
      orChange: ((afterResults.pooledOR - beforeResults.pooledOR) / beforeResults.pooledOR) * 100,
      zChange: afterResults.finalZ - beforeResults.finalZ,
      infoFractionChange: (afterResults.informationFraction - beforeResults.informationFraction) * 100,
      conclusionChanged: beforeResults.interpretation.type !== afterResults.interpretation.type,
    };

    // Generate summary
    const summaryText = this.generateComparisonSummary(beforeResults, afterResults, changes);

    return {
      timestamp,
      beforeScreenshot,
      afterScreenshot,
      beforeResults,
      afterResults,
      changes,
      summaryText,
    };
  }

  /**
   * Save screenshot to file
   */
  async saveScreenshot(buffer: Buffer, filename: string): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Ensure output directory exists
    await fs.mkdir(this.config.outputDir!, { recursive: true });

    const filePath = path.join(this.config.outputDir!, filename);
    await fs.writeFile(filePath, buffer);

    return filePath;
  }

  /**
   * Generate HTML report with embedded screenshots
   */
  async generateHTMLReport(report: ReportWithScreenshots): Promise<string> {
    const chartBase64 = report.chartScreenshot.toString('base64');
    const fullBase64 = report.fullPageScreenshot.toString('base64');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TSA Report - ${report.timestamp}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #1a1a2e;
      color: #e0e0e0;
    }
    h1 { color: #00d4ff; }
    h2 { color: #00d4ff; margin-top: 30px; }
    .summary {
      background: #16213e;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .stat {
      background: #0f3460;
      padding: 15px;
      border-radius: 6px;
    }
    .stat-label {
      color: #888;
      font-size: 12px;
      text-transform: uppercase;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #00d4ff;
    }
    .screenshot {
      margin: 20px 0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .screenshot img {
      width: 100%;
      display: block;
    }
    .interpretation {
      background: ${report.results.interpretation.type.includes('benefit') ? '#0a4d0a' :
                    report.results.interpretation.type.includes('harm') ? '#4d0a0a' :
                    report.results.interpretation.type === 'futility' ? '#4d4d0a' : '#333'};
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <h1>Trial Sequential Analysis Report</h1>
  <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>

  <div class="interpretation">
    <strong>${report.results.interpretation.title}</strong>
    <p>${report.results.interpretation.message}</p>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-label">Pooled OR</div>
      <div class="stat-value">${report.results.pooledOR.toFixed(2)}</div>
      <div>[${report.results.ci95Lower.toFixed(2)}, ${report.results.ci95Upper.toFixed(2)}]</div>
    </div>
    <div class="stat">
      <div class="stat-label">Z-Score</div>
      <div class="stat-value">${report.results.finalZ.toFixed(2)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Information</div>
      <div class="stat-value">${(report.results.informationFraction * 100).toFixed(1)}%</div>
      <div>of RIS (${report.results.ris.toLocaleString()})</div>
    </div>
    <div class="stat">
      <div class="stat-label">Patients</div>
      <div class="stat-value">${report.results.totalPatients.toLocaleString()}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Heterogeneity (I²)</div>
      <div class="stat-value">${report.results.heterogeneity.i2.toFixed(1)}%</div>
    </div>
  </div>

  <h2>TSA Chart</h2>
  <div class="screenshot">
    <img src="data:image/png;base64,${chartBase64}" alt="TSA Chart">
  </div>

  <h2>Full View</h2>
  <div class="screenshot">
    <img src="data:image/png;base64,${fullBase64}" alt="Full Page">
  </div>

  <div class="summary">
    <h3>Summary</h3>
    <pre>${report.summaryText}</pre>
  </div>
</body>
</html>`;

    return html;
  }

  /**
   * Generate text summary
   */
  private generateSummaryText(results: TSAResults): string {
    const lines = [
      '='.repeat(60),
      'TRIAL SEQUENTIAL ANALYSIS RESULTS',
      '='.repeat(60),
      '',
      `CONCLUSION: ${results.interpretation.title}`,
      '',
      `${results.interpretation.message}`,
      '',
      '-'.repeat(60),
      'KEY STATISTICS',
      '-'.repeat(60),
      `Pooled OR:           ${results.pooledOR.toFixed(3)} [${results.ci95Lower.toFixed(3)}, ${results.ci95Upper.toFixed(3)}]`,
      `Z-Score:             ${results.finalZ.toFixed(3)}`,
      `Required Info Size:  ${results.ris.toLocaleString()} patients`,
      `Accrued Patients:    ${results.totalPatients.toLocaleString()} patients`,
      `Information Fraction: ${(results.informationFraction * 100).toFixed(1)}%`,
      '',
      '-'.repeat(60),
      'HETEROGENEITY',
      '-'.repeat(60),
      `Q-statistic:         ${results.heterogeneity.q.toFixed(2)}`,
      `I² statistic:        ${results.heterogeneity.i2.toFixed(1)}%`,
      `τ² (tau-squared):    ${results.heterogeneity.tau2.toFixed(4)}`,
      `P-value:             ${results.heterogeneity.pValue.toFixed(4)}`,
      '',
      '='.repeat(60),
    ];

    return lines.join('\n');
  }

  /**
   * Generate comparison summary
   */
  private generateComparisonSummary(
    before: TSAResults,
    after: TSAResults,
    changes: ComparisonReport['changes']
  ): string {
    const lines = [
      '='.repeat(60),
      'TSA COMPARISON REPORT',
      '='.repeat(60),
      '',
      `Conclusion Changed: ${changes.conclusionChanged ? 'YES' : 'NO'}`,
      '',
      'BEFORE:',
      `  Interpretation: ${before.interpretation.title}`,
      `  OR: ${before.pooledOR.toFixed(3)} [${before.ci95Lower.toFixed(3)}, ${before.ci95Upper.toFixed(3)}]`,
      `  Z: ${before.finalZ.toFixed(3)}`,
      `  Info: ${(before.informationFraction * 100).toFixed(1)}%`,
      '',
      'AFTER:',
      `  Interpretation: ${after.interpretation.title}`,
      `  OR: ${after.pooledOR.toFixed(3)} [${after.ci95Lower.toFixed(3)}, ${after.ci95Upper.toFixed(3)}]`,
      `  Z: ${after.finalZ.toFixed(3)}`,
      `  Info: ${(after.informationFraction * 100).toFixed(1)}%`,
      '',
      'CHANGES:',
      `  OR Change: ${changes.orChange >= 0 ? '+' : ''}${changes.orChange.toFixed(1)}%`,
      `  Z Change: ${changes.zChange >= 0 ? '+' : ''}${changes.zChange.toFixed(3)}`,
      `  Info Change: ${changes.infoFractionChange >= 0 ? '+' : ''}${changes.infoFractionChange.toFixed(1)}%`,
      '',
      '='.repeat(60),
    ];

    return lines.join('\n');
  }
}

export default ScreenshotReporter;
