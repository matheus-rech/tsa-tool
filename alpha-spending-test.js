// Test alpha spending with different formulas to identify the issue

// Standard normal CDF
function normalCDF(x) {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

// Normal quantile function
function normalQuantile(p) {
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
  let q, r;

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

console.log('Testing Alpha Spending Function Formulas');
console.log('='.repeat(80));

const alpha = 0.05;
const testPoints = [0.1, 0.25, 0.5, 0.75, 1.0];

console.log('\\nFormula 1: alpha*(t) = 2[1 - Phi(Phi^-1(1 - alpha/2) / sqrt(t))]');
console.log('(Current implementation)');
console.log('-'.repeat(80));
console.log('t     | alpha*(t)  | Boundary z | Notes');
console.log('-'.repeat(80));

testPoints.forEach(function(t) {
  const zAlpha = normalQuantile(1 - alpha / 2);
  const alphaSpent = t >= 1 ? alpha : 2 * (1 - normalCDF(zAlpha / Math.sqrt(t)));
  const boundary = zAlpha / Math.sqrt(t);
  const paddedT = t.toFixed(2).padEnd(5);
  const paddedAlpha = alphaSpent.toFixed(8).padEnd(10);
  const paddedBoundary = boundary.toFixed(4).padEnd(10);
  console.log(paddedT + ' | ' + paddedAlpha + ' | ' + paddedBoundary + ' | ' + (t === 1 ? 'Final' : ''));
});

console.log('\\n\\nFormula 2: alpha*(t) = 2*Phi(-Phi^-1(alpha/2) / sqrt(t))');
console.log('(Alternative from some references)');
console.log('-'.repeat(80));
console.log('t     | alpha*(t)  | Boundary z | Notes');
console.log('-'.repeat(80));

testPoints.forEach(function(t) {
  const alphaSpent = t >= 1 ? alpha : 2 * normalCDF(-normalQuantile(1 - alpha/2) / Math.sqrt(t));
  const boundary = normalQuantile(1 - alpha/2) / Math.sqrt(t);
  const paddedT = t.toFixed(2).padEnd(5);
  const paddedAlpha = alphaSpent.toFixed(8).padEnd(10);
  const paddedBoundary = boundary.toFixed(4).padEnd(10);
  console.log(paddedT + ' | ' + paddedAlpha + ' | ' + paddedBoundary + ' | ' + (t === 1 ? 'Final' : ''));
});

console.log('\\n\\nKey Statistical Values:');
console.log('-'.repeat(80));
console.log('Phi^-1(0.975) = ' + normalQuantile(0.975).toFixed(6) + ' (expected: 1.96)');
console.log('Phi^-1(0.025) = ' + normalQuantile(0.025).toFixed(6) + ' (expected: -1.96)');
console.log('Phi(1.96) = ' + normalCDF(1.96).toFixed(6) + ' (expected: 0.975)');
console.log('Phi(-1.96) = ' + normalCDF(-1.96).toFixed(6) + ' (expected: 0.025)');

console.log('\\n\\nIncrements in alpha spending:');
console.log('-'.repeat(80));
console.log('From t    | To t      | Increment');
console.log('-'.repeat(80));

let prevAlpha = 0;
testPoints.forEach(function(t) {
  const zAlpha = normalQuantile(1 - alpha / 2);
  const alphaSpent = t >= 1 ? alpha : 2 * (1 - normalCDF(zAlpha / Math.sqrt(t)));
  const increment = alphaSpent - prevAlpha;
  console.log((prevAlpha * 100).toFixed(6) + '% | ' + (alphaSpent * 100).toFixed(6) + '% | ' + (increment * 100).toFixed(6) + '%');
  prevAlpha = alphaSpent;
});
