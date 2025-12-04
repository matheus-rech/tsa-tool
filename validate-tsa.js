// Comprehensive TSA Validation Script
// Compares implementation against Copenhagen TSA reference values

import {
  normalQuantile,
  normalCDF,
  lanDeMetsAlphaSpending,
  computeMonitoringBoundary,
  calculateRIS,
  calculatePooledOR,
  calculateTSA,
  calculateZStatistic
} from './src/lib/statistics.ts';

import { exampleStudies, exampleParams } from './src/data.ts';

console.log('='.repeat(80));
console.log('TSA IMPLEMENTATION VALIDATION REPORT');
console.log('='.repeat(80));
console.log('\n');

// =============================================================================
// 1. O'Brien-Fleming Monitoring Boundary Reference Values
// =============================================================================
console.log('1. O\'BRIEN-FLEMING MONITORING BOUNDARIES');
console.log('-'.repeat(80));
console.log('Formula: z_t = z_{α/2} / √t');
console.log('For α = 0.05 (two-sided), z_{α/2} = 1.96\n');

const alpha = 0.05;
const zAlpha = normalQuantile(1 - alpha / 2);
console.log(`Calculated z_{α/2} = ${zAlpha.toFixed(4)} (expected: 1.96)\n`);

const obfReferenceValues = [
  { t: 0.25, expected: 3.92 },
  { t: 0.50, expected: 2.77 },
  { t: 0.75, expected: 2.26 },
  { t: 1.00, expected: 1.96 }
];

console.log('Information  | Expected  | Actual    | Difference | % Error');
console.log('Fraction (t) | Boundary  | Boundary  |            |        ');
console.log('-'.repeat(70));

obfReferenceValues.forEach(({ t, expected }) => {
  const actual = computeMonitoringBoundary(t, alpha);
  const diff = actual - expected;
  const percentError = Math.abs((diff / expected) * 100);
  const status = percentError < 2 ? '✓' : '✗';

  console.log(
    `${t.toFixed(2).padEnd(12)} | ` +
    `${expected.toFixed(2).padEnd(9)} | ` +
    `${actual.toFixed(2).padEnd(9)} | ` +
    `${diff.toFixed(3).padEnd(10)} | ` +
    `${percentError.toFixed(2)}% ${status}`
  );
});

console.log('\n');

// =============================================================================
// 2. Lan-DeMets Alpha Spending Function Reference Values
// =============================================================================
console.log('2. LAN-DEMETS ALPHA SPENDING FUNCTION');
console.log('-'.repeat(80));
console.log('Formula: α*(t) = 2[1 - Φ(Φ⁻¹(1 - α/2) / √t)]\n');

const alphaSpendingReferenceValues = [
  { t: 0.10, expected: 0.000015 },
  { t: 0.25, expected: 0.000151 },
  { t: 0.50, expected: 0.005478 },
  { t: 0.75, expected: 0.019638 },
  { t: 1.00, expected: 0.050000 }
];

console.log('Information  | Expected  | Actual       | Difference    | % Error');
console.log('Fraction (t) | α*(t)     | α*(t)        |               |        ');
console.log('-'.repeat(75));

alphaSpendingReferenceValues.forEach(({ t, expected }) => {
  const actual = lanDeMetsAlphaSpending(t, alpha);
  const diff = actual - expected;
  const percentError = Math.abs((diff / expected) * 100);
  const status = percentError < 5 ? '✓' : '✗';

  console.log(
    `${t.toFixed(2).padEnd(12)} | ` +
    `${expected.toFixed(6).padEnd(9)} | ` +
    `${actual.toFixed(6).padEnd(12)} | ` +
    `${diff.toFixed(6).padEnd(13)} | ` +
    `${percentError.toFixed(2)}% ${status}`
  );
});

console.log('\n');

// =============================================================================
// 3. Required Information Size (RIS) Calculation
// =============================================================================
console.log('3. REQUIRED INFORMATION SIZE (RIS) CALCULATION');
console.log('-'.repeat(80));
console.log('Parameters from example dataset:');
console.log(`  α = ${exampleParams.alpha}`);
console.log(`  β = ${exampleParams.beta} (Power = ${(1 - exampleParams.beta) * 100}%)`);
console.log(`  Control rate (p₀) = ${exampleParams.controlRate * 100}%`);
console.log(`  Effect size (RRR) = ${exampleParams.effectSize}%`);
console.log(`  Heterogeneity correction = ${exampleParams.heterogeneityCorrection}\n`);

const ris = calculateRIS(exampleParams);
console.log(`Calculated RIS = ${ris.toLocaleString()} patients\n`);

// Manual calculation for verification
const p0 = exampleParams.controlRate;
const p1 = p0 * (1 - exampleParams.effectSize / 100);
const odds0 = p0 / (1 - p0);
const odds1 = p1 / (1 - p1);
const anticipatedOR = odds1 / odds0;
const logOR = Math.log(anticipatedOR);

console.log('Manual verification:');
console.log(`  Treatment rate (p₁) = ${(p1 * 100).toFixed(2)}%`);
console.log(`  Control odds = ${odds0.toFixed(4)}`);
console.log(`  Treatment odds = ${odds1.toFixed(4)}`);
console.log(`  Anticipated OR = ${anticipatedOR.toFixed(4)}`);
console.log(`  ln(OR) = ${logOR.toFixed(4)}`);

const zAlphaRIS = normalQuantile(1 - exampleParams.alpha / 2);
const zBeta = normalQuantile(1 - exampleParams.beta);
const varComponent = 1 / (p1 * (1 - p1)) + 1 / (p0 * (1 - p0));
const nPerArm = Math.pow(zAlphaRIS + zBeta, 2) * varComponent / Math.pow(logOR, 2);
const totalN = 2 * nPerArm * exampleParams.heterogeneityCorrection;

console.log(`  z_{α/2} = ${zAlphaRIS.toFixed(4)}`);
console.log(`  z_β = ${zBeta.toFixed(4)}`);
console.log(`  Variance component = ${varComponent.toFixed(4)}`);
console.log(`  n per arm = ${Math.ceil(nPerArm).toLocaleString()}`);
console.log(`  Total N (both arms) = ${Math.ceil(totalN).toLocaleString()}\n`);

console.log('\n');

// =============================================================================
// 4. Example Dataset Analysis
// =============================================================================
console.log('4. EXAMPLE DATASET: TRA vs TFA - ACCESS SITE COMPLICATIONS');
console.log('-'.repeat(80));

const pooledResult = calculatePooledOR(exampleStudies);
console.log(`Pooled OR (Mantel-Haenszel) = ${pooledResult.or.toFixed(4)}`);
console.log(`SE(ln(OR)) = ${pooledResult.se.toFixed(4)}`);
console.log(`95% CI: ${Math.exp(Math.log(pooledResult.or) - 1.96 * pooledResult.se).toFixed(2)} to ${Math.exp(Math.log(pooledResult.or) + 1.96 * pooledResult.se).toFixed(2)}\n`);

const finalZ = calculateZStatistic(exampleStudies);
console.log(`Final Z-statistic = ${finalZ.toFixed(4)}`);
console.log(`ln(OR) = ${Math.log(pooledResult.or).toFixed(4)}\n`);

// Total sample size
const totalPatients = exampleStudies.reduce((sum, s) => sum + s.totalTrt + s.totalCtrl, 0);
console.log(`Total enrolled patients = ${totalPatients.toLocaleString()}`);
console.log(`RIS = ${ris.toLocaleString()}`);
console.log(`Information fraction = ${((totalPatients / ris) * 100).toFixed(1)}%\n`);

// TSA Results
const tsaResults = calculateTSA(exampleStudies, exampleParams);
if (tsaResults) {
  console.log('TSA Interpretation:');
  console.log(`  Type: ${tsaResults.interpretation.type}`);
  console.log(`  Title: ${tsaResults.interpretation.title}`);
  console.log(`  Message: ${tsaResults.interpretation.message}\n`);

  // Show cumulative analysis for selected timepoints
  console.log('Cumulative Analysis (Selected Timepoints):');
  console.log('-'.repeat(80));

  const timepoints = [0, Math.floor(tsaResults.cumulativeData.length / 2), tsaResults.cumulativeData.length - 1];

  console.log('Study'.padEnd(30) + '| N     | Info% | Z-stat | Boundary | α-spent');
  console.log('-'.repeat(80));

  timepoints.forEach(idx => {
    const point = tsaResults.cumulativeData[idx];
    console.log(
      point.study.padEnd(30) + '| ' +
      point.patients.toString().padEnd(5) + ' | ' +
      (point.informationFraction * 100).toFixed(1).padEnd(5) + ' | ' +
      point.zStatistic.toFixed(2).padEnd(6) + ' | ' +
      point.monitoringBoundary.toFixed(2).padEnd(8) + ' | ' +
      point.alphaSpent.toFixed(5)
    );
  });
}

console.log('\n');

// =============================================================================
// 5. SUMMARY
// =============================================================================
console.log('5. VALIDATION SUMMARY');
console.log('='.repeat(80));

let totalTests = 0;
let passedTests = 0;

// O'Brien-Fleming boundaries
obfReferenceValues.forEach(({ t, expected }) => {
  totalTests++;
  const actual = computeMonitoringBoundary(t, alpha);
  const percentError = Math.abs(((actual - expected) / expected) * 100);
  if (percentError < 2) passedTests++;
});

// Alpha spending
alphaSpendingReferenceValues.forEach(({ t, expected }) => {
  totalTests++;
  const actual = lanDeMetsAlphaSpending(t, alpha);
  const percentError = Math.abs(((actual - expected) / expected) * 100);
  if (percentError < 5) passedTests++;
});

// Basic statistical functions
totalTests += 3;
if (Math.abs(normalQuantile(0.975) - 1.96) < 0.01) passedTests++;
if (Math.abs(normalCDF(1.96) - 0.975) < 0.001) passedTests++;
if (Math.abs(normalCDF(0) - 0.5) < 0.00001) passedTests++;

console.log(`Tests Passed: ${passedTests}/${totalTests}`);
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);

if (passedTests === totalTests) {
  console.log('✓ ALL VALIDATION TESTS PASSED');
  console.log('✓ Implementation is aligned with Copenhagen TSA methodology');
} else {
  console.log(`⚠ ${totalTests - passedTests} tests failed validation`);
  console.log('⚠ Review implementation against Copenhagen TSA reference values');
}

console.log('\n' + '='.repeat(80));
console.log('END OF VALIDATION REPORT');
console.log('='.repeat(80));
