export interface Study {
  id: string;
  name: string;
  year: number;
  eventsTrt: number;
  totalTrt: number;
  eventsCtrl: number;
  totalCtrl: number;
}

export interface ContinuousStudy {
  id: string;
  name: string;
  year: number;
  meanTrt: number;
  sdTrt: number;
  nTrt: number;
  meanCtrl: number;
  sdCtrl: number;
  nCtrl: number;
}

export type FutilityBoundaryType = 'none' | 'obrien-fleming' | 'pocock' | 'conditional-power';

export interface TSAParams {
  alpha: number;
  beta: number;
  controlRate: number;
  effectSize: number;
  heterogeneityCorrection: number;
  futilityBoundaryType?: FutilityBoundaryType;
  useI2Adjustment?: boolean;
}

export interface CumulativeDataPoint {
  study: string;
  patients: number;
  informationFraction: number;
  zStatistic: number;
  monitoringBoundary: number;
  futilityBoundary: number;
  pooledOR: number;
  ci95Lower: number;
  ci95Upper: number;
  alphaSpent: number;
  betaSpent: number;
}

export interface HeterogeneityStats {
  q: number;
  i2: number;
  tau2: number;
  pValue: number;
}

export interface TSAInterpretation {
  type: 'conclusive-benefit' | 'conclusive-harm' | 'futility' | 'inconclusive';
  title: string;
  message: string;
}

export interface TSAResults {
  ris: number;
  totalPatients: number;
  informationFraction: number;
  pooledOR: number;
  ci95Lower: number;
  ci95Upper: number;
  finalZ: number;
  cumulativeData: CumulativeDataPoint[];
  interpretation: TSAInterpretation;
  heterogeneity: HeterogeneityStats;
}

export interface ForestPlotData {
  study: string;
  or: number;
  ci95Lower: number;
  ci95Upper: number;
  weight: number;
  eventsTrt: number;
  totalTrt: number;
  eventsCtrl: number;
  totalCtrl: number;
}
