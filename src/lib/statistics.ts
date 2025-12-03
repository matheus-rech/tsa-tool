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

// O'Brien-Fleming alpha-spending boundary
export function obrienFlemingBoundary(informationFraction: number, alpha: number): number {
  if (informationFraction <= 0) return 10;
  const z = normalQuantile(1 - alpha / 2);
  return z / Math.sqrt(informationFraction);
}

// Calculate odds ratio for a single study
export function calculateStudyOR(study: Study): { or: number; se: number; weight: number } {
  const a = study.eventsTrt + 0.5;
  const b = study.totalTrt - study.eventsTrt + 0.5;
  const c = study.eventsCtrl + 0.5;
  const d = study.totalCtrl - study.eventsCtrl + 0.5;
  
  const or = (a * d) / (b * c);
  const se = Math.sqrt(1/a + 1/b + 1/c + 1/d);
  const weight = 1 / (se * se);
  
  return { or, se, weight };
}

// Calculate pooled odds ratio using Mantel-Haenszel method
export function calculatePooledOR(studies: Study[]): { or: number; se: number } {
  let numerator = 0;
  let denominator = 0;
  
  studies.forEach(study => {
    const a = study.eventsTrt + 0.5;
    const b = study.totalTrt - study.eventsTrt + 0.5;
    const c = study.eventsCtrl + 0.5;
    const d = study.totalCtrl - study.eventsCtrl + 0.5;
    const n = study.totalTrt + study.totalCtrl;
    
    if (n > 0) {
      numerator += (a * d) / n;
      denominator += (b * c) / n;
    }
  });
  
  const or = denominator > 0 ? numerator / denominator : 1;
  
  // Calculate variance using Greenland-Robins method
  let variance = 0;
  studies.forEach(study => {
    const a = study.eventsTrt + 0.5;
    const b = study.totalTrt - study.eventsTrt + 0.5;
    const c = study.eventsCtrl + 0.5;
    const d = study.totalCtrl - study.eventsCtrl + 0.5;
    variance += 1/a + 1/b + 1/c + 1/d;
  });
  
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

// Calculate Required Information Size (RIS)
export function calculateRIS(params: TSAParams): number {
  const { alpha, beta, controlRate, effectSize, heterogeneityCorrection } = params;
  const zAlpha = normalQuantile(1 - alpha / 2);
  const zBeta = normalQuantile(1 - beta);
  
  const treatmentRate = controlRate * (1 - effectSize / 100);
  const pooledRate = (controlRate + treatmentRate) / 2;
  
  if (Math.abs(controlRate - treatmentRate) < 0.001) return 100000;
  
  const n = ((zAlpha + zBeta) ** 2 * 2 * pooledRate * (1 - pooledRate)) / 
            ((controlRate - treatmentRate) ** 2);
  
  return Math.ceil(2 * n * heterogeneityCorrection);
}

// Main TSA calculation function
export function calculateTSA(studies: Study[], params: TSAParams): TSAResults | null {
  if (studies.length === 0) return null;
  
  const ris = calculateRIS(params);
  const cumulativeData: CumulativeDataPoint[] = [];
  let cumulativeN = 0;
  
  for (let i = 0; i < studies.length; i++) {
    const cumulativeStudies = studies.slice(0, i + 1);
    cumulativeN += studies[i].totalTrt + studies[i].totalCtrl;
    
    const { or, se } = calculatePooledOR(cumulativeStudies);
    const zStat = Math.log(or) / se;
    const informationFraction = cumulativeN / ris;
    const monitoringBoundary = obrienFlemingBoundary(informationFraction, params.alpha);
    
    cumulativeData.push({
      study: `${studies[i].name} (${studies[i].year})`,
      patients: cumulativeN,
      informationFraction,
      zStatistic: zStat,
      monitoringBoundary,
      futilityBoundary: monitoringBoundary * 0.5,
      pooledOR: or,
      ci95Lower: Math.exp(Math.log(or) - 1.96 * se),
      ci95Upper: Math.exp(Math.log(or) + 1.96 * se)
    });
  }
  
  const last = cumulativeData[cumulativeData.length - 1];
  const heterogeneity = calculateHeterogeneity(studies);
  
  // Determine interpretation
  let interpretation: TSAResults['interpretation'];
  
  if (Math.abs(last.zStatistic) > last.monitoringBoundary) {
    interpretation = {
      type: last.zStatistic > 0 ? 'conclusive-benefit' : 'conclusive-harm',
      title: last.zStatistic > 0 ? 'Conclusive: Favors Treatment' : 'Conclusive: Favors Control',
      message: 'The Z-curve has crossed the monitoring boundary, providing conclusive evidence of a treatment effect.'
    };
  } else if (Math.abs(last.zStatistic) < last.futilityBoundary) {
    interpretation = {
      type: 'futility',
      title: 'Futility: Treatments Likely Similar',
      message: 'The Z-curve is within the futility boundary, indicating high probability that treatments have similar effects.'
    };
  } else {
    interpretation = {
      type: 'inconclusive',
      title: 'Inconclusive',
      message: 'More studies are needed. The Z-curve has not crossed monitoring or futility boundaries.'
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
