import { Study, TSAParams, TSAResults, CumulativeDataPoint, ForestPlotData } from '@/types';

// Normal distribution quantile function (inverse CDF)
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 
             1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 
             6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, 
             -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 
             3.754408661907416e+00];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number, r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / 
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / 
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / 
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

// Standard normal cumulative distribution function (CDF)
// Uses Abramowitz & Stegun approximation (equation 7.1.26)
export function normalCDF(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  // Save the sign of x
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);

  // A&S formula 7.1.26 for erf approximation
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

// Chi-squared distribution CDF (for Q-statistic p-value)
export function chiSquaredCDF(x: number, df: number): number {
  if (x <= 0 || df <= 0) return 0;
  return regularizedGammaP(df / 2, x / 2);
}

function regularizedGammaP(a: number, x: number): number {
  if (x === 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 100; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-10) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  } else {
    return 1 - regularizedGammaQ(a, x);
  }
}

function regularizedGammaQ(a: number, x: number): number {
  let b = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;
  
  for (let i = 1; i <= 100; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-10) break;
  }
  
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

function logGamma(x: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
             771.32342877765313, -176.61502916214059, 12.507343278686905,
             -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  
  x -= 1;
  let a = c[0];
  for (let i = 1; i < g + 2; i++) {
    a += c[i] / (x + i);
  }
  const t = x + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// Lan-DeMets alpha-spending function (O'Brien-Fleming type)
// Returns cumulative alpha spent up to information fraction t
// Formula: α*(t) = 2[1 - Φ(Φ⁻¹(1 - α/2) / √t)]
export function lanDeMetsAlphaSpending(t: number, alpha: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return alpha;

  const zAlpha = normalQuantile(1 - alpha / 2);
  return 2 * (1 - normalCDF(zAlpha / Math.sqrt(t)));
}

// Lan-DeMets beta-spending function (O'Brien-Fleming type)
// Returns cumulative beta spent up to information fraction t
// Formula: β*(t) = 2[1 - Φ(Φ⁻¹(1 - β/2) / √t)]
export function lanDeMetsBetaSpending(t: number, beta: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return beta;

  const zBeta = normalQuantile(1 - beta / 2);
  return 2 * (1 - normalCDF(zBeta / Math.sqrt(t)));
}

// Compute O'Brien-Fleming monitoring boundary using Lan-DeMets spending
// The boundary z_t satisfies: 2[1 - Φ(z_t)] = α*(t)
export function computeMonitoringBoundary(informationFraction: number, alpha: number): number {
  if (informationFraction <= 0) return 10;
  if (informationFraction >= 1.5) return normalQuantile(1 - alpha / 2);

  // For the O'Brien-Fleming spending function, the boundary simplifies to:
  // z_t = z_{α/2} / √t
  // This is the exact boundary for the Lan-DeMets O'Brien-Fleming approximation
  const zAlpha = normalQuantile(1 - alpha / 2);
  return zAlpha / Math.sqrt(informationFraction);
}

// Compute futility boundary using beta-spending
// Uses O'Brien-Fleming type beta-spending by default
export function computeFutilityBoundary(
  informationFraction: number,
  beta: number,
  boundaryType: 'none' | 'obrien-fleming' = 'obrien-fleming'
): number {
  if (boundaryType === 'none') return 0;
  if (informationFraction <= 0) return 0;
  if (informationFraction >= 1) return normalQuantile(beta);

  // For O'Brien-Fleming type beta-spending:
  // The futility boundary is the inner boundary that controls Type II error
  // It's typically much smaller than the efficacy boundary at early looks
  const zBeta = normalQuantile(1 - beta / 2);

  // The futility boundary for O'Brien-Fleming is derived from beta spending
  // At fraction t, the boundary is approximately: z_β / √t (scaled appropriately)
  // We use a more conservative approach that aligns with Copenhagen TSA:
  // futility boundary = z_β / √t * correction_factor
  // where correction_factor ensures proper beta spending
  const rawBoundary = zBeta / Math.sqrt(informationFraction);

  // Scale to create the inner wedge (futility region)
  // The factor 0.5 approximates the O'Brien-Fleming futility spending
  // For more precise calculation, numerical methods would be needed
  return Math.min(rawBoundary * 0.5, normalQuantile(1 - beta));
}

// O'Brien-Fleming alpha-spending boundary (backward compatible wrapper)
export function obrienFlemingBoundary(informationFraction: number, alpha: number): number {
  return computeMonitoringBoundary(informationFraction, alpha);
}

// Calculate odds ratio for a single study
// Applies continuity correction ONLY when necessary (zero cells)
export function calculateStudyOR(study: Study): { or: number; se: number; weight: number } {
  let a = study.eventsTrt;
  let b = study.totalTrt - study.eventsTrt;
  let c = study.eventsCtrl;
  let d = study.totalCtrl - study.eventsCtrl;

  // Check if continuity correction is needed (any zero cell)
  const hasZeroCell = a === 0 || b === 0 || c === 0 || d === 0;

  if (hasZeroCell) {
    // Apply 0.5 correction to all cells (standard approach for inverse-variance)
    a += 0.5;
    b += 0.5;
    c += 0.5;
    d += 0.5;
  }

  const or = (a * d) / (b * c);
  const se = Math.sqrt(1/a + 1/b + 1/c + 1/d);
  const weight = 1 / (se * se);

  return { or, se, weight };
}

// Calculate pooled odds ratio using Mantel-Haenszel method
// with Robins-Breslow-Greenland variance estimator (no continuity correction)
export function calculatePooledOR(studies: Study[]): { or: number; se: number } {
  // Filter out double-zero studies (no events in either arm)
  // These contribute no information to the MH estimate
  const validStudies = studies.filter(study =>
    !(study.eventsTrt === 0 && study.eventsCtrl === 0)
  );

  if (validStudies.length === 0) {
    return { or: 1, se: Infinity };
  }

  // Calculate Mantel-Haenszel components using RAW counts (no continuity correction)
  let R = 0;  // Sum of (a*d)/n - numerator of MH OR
  let S = 0;  // Sum of (b*c)/n - denominator of MH OR

  // For Robins-Breslow-Greenland variance
  let sumPR = 0;     // Σ(P_i × R_i)
  let sumPS_QR = 0;  // Σ(P_i × S_i + Q_i × R_i)
  let sumQS = 0;     // Σ(Q_i × S_i)

  validStudies.forEach(study => {
    const a = study.eventsTrt;          // Events in treatment
    const b = study.totalTrt - a;       // Non-events in treatment
    const c = study.eventsCtrl;         // Events in control
    const d = study.totalCtrl - c;      // Non-events in control
    const n = study.totalTrt + study.totalCtrl;

    if (n > 0) {
      const R_i = (a * d) / n;
      const S_i = (b * c) / n;
      const P_i = (a + d) / n;
      const Q_i = (b + c) / n;

      R += R_i;
      S += S_i;

      sumPR += P_i * R_i;
      sumPS_QR += (P_i * S_i) + (Q_i * R_i);
      sumQS += Q_i * S_i;
    }
  });

  // Mantel-Haenszel OR
  const or = S > 0 ? R / S : 1;

  // Robins-Breslow-Greenland variance for ln(OR_MH)
  // Var(ln(OR_MH)) = Σ(P·R)/(2R²) + Σ(P·S + Q·R)/(2RS) + Σ(Q·S)/(2S²)
  let variance = 0;

  if (R > 0 && S > 0) {
    variance = sumPR / (2 * R * R)
             + sumPS_QR / (2 * R * S)
             + sumQS / (2 * S * S);
  } else {
    // Fallback for edge cases (all events or no events)
    variance = Infinity;
  }

  const se = Math.sqrt(variance);

  return { or, se };
}

// Calculate heterogeneity statistics (Q, I², τ²)
export function calculateHeterogeneity(studies: Study[]): { q: number; i2: number; tau2: number; pValue: number } {
  if (studies.length < 2) return { q: 0, i2: 0, tau2: 0, pValue: 1 };
  
  const pooled = calculatePooledOR(studies);
  const logPooledOR = Math.log(pooled.or);
  
  let q = 0;
  let sumWeights = 0;
  let sumWeightsSquared = 0;
  
  studies.forEach(study => {
    const { or, se } = calculateStudyOR(study);
    const logOR = Math.log(or);
    const weight = 1 / (se * se);
    
    q += weight * Math.pow(logOR - logPooledOR, 2);
    sumWeights += weight;
    sumWeightsSquared += weight * weight;
  });
  
  const df = studies.length - 1;
  const c = sumWeights - sumWeightsSquared / sumWeights;
  
  // Calculate tau² using DerSimonian-Laird method
  const tau2 = Math.max(0, (q - df) / c);
  
  // Calculate I²
  const i2 = Math.max(0, Math.min(100, ((q - df) / q) * 100));
  
  // Calculate p-value for Q statistic
  const pValue = 1 - chiSquaredCDF(q, df);
  
  return { q, i2, tau2, pValue };
}

// Calculate Z-statistic for cumulative analysis
export function calculateZStatistic(studies: Study[]): number {
  if (studies.length === 0) return 0;
  const { or, se } = calculatePooledOR(studies);
  return Math.log(or) / se;
}

// Calculate Required Information Size (RIS) for Odds Ratio
// Uses the variance formula for log-OR, aligned with Copenhagen TSA methodology
export function calculateRIS(params: TSAParams): number {
  const { alpha, beta, controlRate, effectSize, heterogeneityCorrection } = params;

  const zAlpha = normalQuantile(1 - alpha / 2);
  const zBeta = normalQuantile(1 - beta);

  const p0 = controlRate;  // Control event rate

  // Calculate anticipated treatment rate from effect size (relative risk reduction)
  // Effect size is RRR as percentage: treatment rate = control rate × (1 - RRR/100)
  const p1 = controlRate * (1 - effectSize / 100);

  // Validate rates
  if (p0 <= 0 || p0 >= 1 || p1 <= 0 || p1 >= 1) {
    return 100000;
  }

  // Calculate anticipated odds ratio
  const odds0 = p0 / (1 - p0);
  const odds1 = p1 / (1 - p1);
  const anticipatedOR = odds1 / odds0;
  const logOR = Math.log(anticipatedOR);

  if (Math.abs(logOR) < 0.001) {
    return 100000;  // Effect size too small
  }

  // Variance components for log-OR
  // For equal allocation (n1 = n0 = n per arm):
  // Var(ln(OR)) ≈ [1/(n×p1×(1-p1)) + 1/(n×p0×(1-p0))]
  // Solving for n: n = (z_α/2 + z_β)² × [1/(p1(1-p1)) + 1/(p0(1-p0))] / (ln(OR))²
  const varComponent = 1 / (p1 * (1 - p1)) + 1 / (p0 * (1 - p0));

  const nPerArm = Math.pow(zAlpha + zBeta, 2) * varComponent / Math.pow(logOR, 2);

  // Total sample size (both arms) with heterogeneity correction
  // The correction can be: multiplier directly, or derived from I² as 1/(1-I²)
  const totalN = 2 * nPerArm * heterogeneityCorrection;

  return Math.ceil(totalN);
}

// Calculate RIS with I² heterogeneity adjustment
// RIS_adjusted = RIS / (1 - I²)
export function calculateRISWithI2(params: TSAParams, i2: number): number {
  // First calculate base RIS without heterogeneity correction
  const baseParams = { ...params, heterogeneityCorrection: 1 };
  const baseRIS = calculateRIS(baseParams);

  // Apply I² adjustment: multiply by 1/(1 - I²)
  // Avoid division by zero when I² approaches 1 (100%)
  const i2Decimal = i2 / 100;  // Convert from percentage
  const adjustmentFactor = i2Decimal < 0.99 ? 1 / (1 - i2Decimal) : 100;

  return Math.ceil(baseRIS * adjustmentFactor);
}

// Main TSA calculation function
// Implements Copenhagen Trial Unit methodology with Lan-DeMets spending functions
export function calculateTSA(studies: Study[], params: TSAParams): TSAResults | null {
  if (studies.length === 0) return null;

  // Calculate heterogeneity first (may be used for I² adjusted RIS)
  const heterogeneity = calculateHeterogeneity(studies);

  // Calculate RIS
  const ris = calculateRIS(params);
  const cumulativeData: CumulativeDataPoint[] = [];
  let cumulativeN = 0;

  for (let i = 0; i < studies.length; i++) {
    const cumulativeStudies = studies.slice(0, i + 1);
    cumulativeN += studies[i].totalTrt + studies[i].totalCtrl;

    const { or, se } = calculatePooledOR(cumulativeStudies);
    // Handle edge case where SE is infinite or zero
    const zStat = (se > 0 && se < Infinity) ? Math.log(or) / se : 0;
    const informationFraction = cumulativeN / ris;

    // Use Lan-DeMets spending functions for boundaries
    const monitoringBoundary = computeMonitoringBoundary(informationFraction, params.alpha);
    const futilityBoundary = computeFutilityBoundary(informationFraction, params.beta);

    // Calculate cumulative alpha and beta spending at this information fraction
    const alphaSpent = lanDeMetsAlphaSpending(informationFraction, params.alpha);
    const betaSpent = lanDeMetsBetaSpending(informationFraction, params.beta);

    cumulativeData.push({
      study: `${studies[i].name} (${studies[i].year})`,
      patients: cumulativeN,
      informationFraction,
      zStatistic: zStat,
      monitoringBoundary,
      futilityBoundary,
      pooledOR: or,
      ci95Lower: Math.exp(Math.log(or) - 1.96 * se),
      ci95Upper: Math.exp(Math.log(or) + 1.96 * se),
      alphaSpent,
      betaSpent
    });
  }

  const last = cumulativeData[cumulativeData.length - 1];

  // Determine interpretation with improved messages
  let interpretation: TSAResults['interpretation'];
  const percentComplete = (last.informationFraction * 100).toFixed(0);

  if (Math.abs(last.zStatistic) > last.monitoringBoundary) {
    interpretation = {
      type: last.zStatistic > 0 ? 'conclusive-benefit' : 'conclusive-harm',
      title: last.zStatistic > 0 ? 'Conclusive: Favors Treatment' : 'Conclusive: Favors Control',
      message: `The Z-curve has crossed the O'Brien-Fleming monitoring boundary at ${percentComplete}% information, providing conclusive evidence with Type I error control.`
    };
  } else if (last.futilityBoundary > 0 && Math.abs(last.zStatistic) < last.futilityBoundary) {
    interpretation = {
      type: 'futility',
      title: 'Futility: Treatments Likely Similar',
      message: `The Z-curve is within the futility boundary at ${percentComplete}% information, indicating the anticipated effect is unlikely to exist.`
    };
  } else {
    interpretation = {
      type: 'inconclusive',
      title: 'Inconclusive',
      message: `More studies needed (${percentComplete}% of required information). The Z-curve has not crossed monitoring or futility boundaries.`
    };
  }

  return {
    ris,
    totalPatients: last.patients,
    informationFraction: last.informationFraction,
    pooledOR: last.pooledOR,
    ci95Lower: last.ci95Lower,
    ci95Upper: last.ci95Upper,
    finalZ: last.zStatistic,
    cumulativeData,
    interpretation,
    heterogeneity
  };
}

// Generate forest plot data
export function generateForestPlotData(studies: Study[]): ForestPlotData[] {
  const studyStats = studies.map(study => {
    const { or, se, weight } = calculateStudyOR(study);
    return {
      study: `${study.name} (${study.year})`,
      or,
      ci95Lower: Math.exp(Math.log(or) - 1.96 * se),
      ci95Upper: Math.exp(Math.log(or) + 1.96 * se),
      weight,
      eventsTrt: study.eventsTrt,
      totalTrt: study.totalTrt,
      eventsCtrl: study.eventsCtrl,
      totalCtrl: study.totalCtrl
    };
  });
  
  // Normalize weights
  const totalWeight = studyStats.reduce((sum, s) => sum + s.weight, 0);
  return studyStats.map(s => ({ ...s, weight: (s.weight / totalWeight) * 100 }));
}

// Export data to CSV
export function exportToCSV(studies: Study[], results: TSAResults | null): string {
  let csv = 'Study,Year,Events Trt,Total Trt,Events Ctrl,Total Ctrl\n';
  
  studies.forEach(study => {
    csv += `"${study.name}",${study.year},${study.eventsTrt},${study.totalTrt},${study.eventsCtrl},${study.totalCtrl}\n`;
  });
  
  if (results) {
    csv += '\n\nCumulative Analysis\n';
    csv += 'Study,Cumulative N,Info Fraction,Z-Score,Monitoring Boundary,Pooled OR,95% CI Lower,95% CI Upper\n';
    
    results.cumulativeData.forEach(point => {
      csv += `"${point.study}",${point.patients},${(point.informationFraction * 100).toFixed(1)}%,${point.zStatistic.toFixed(3)},±${point.monitoringBoundary.toFixed(2)},${point.pooledOR.toFixed(2)},${point.ci95Lower.toFixed(2)},${point.ci95Upper.toFixed(2)}\n`;
    });
    
    csv += '\n\nSummary\n';
    csv += `Required Information Size,${results.ris}\n`;
    csv += `Total Patients,${results.totalPatients}\n`;
    csv += `Information Fraction,${(results.informationFraction * 100).toFixed(1)}%\n`;
    csv += `Pooled OR,${results.pooledOR.toFixed(2)} (${results.ci95Lower.toFixed(2)} - ${results.ci95Upper.toFixed(2)})\n`;
    csv += `Final Z-Score,${results.finalZ.toFixed(3)}\n`;
    csv += `I²,${results.heterogeneity.i2.toFixed(1)}%\n`;
    csv += `Interpretation,${results.interpretation.title}\n`;
  }
  
  return csv;
}
