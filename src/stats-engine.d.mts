export interface CsvColumnSummary {
  column: string;
  n: number;
  mean: number;
  sd: number;
  median: number;
  iqr: number;
  min: number;
  max: number;
}

export function parseCsvTable(csvText: string): {
  columns: string[];
  rows: string[][];
  rowCount: number;
  numericColumns: Record<string, number[]>;
  summaries: CsvColumnSummary[];
};

export function twoTailedTTestPValue(absT: number, df: number): number;

export function runWelchTTest(groupA: number[], groupB: number[]): {
  nA: number;
  nB: number;
  meanA: number;
  meanB: number;
  sdA: number;
  sdB: number;
  meanDiff: number;
  tStat: number;
  df: number;
  pValue: number;
  cohensD: number;
  ci95: [number, number];
  significantAt05: boolean;
  summary: string;
};

export function runCorrelationAnalysis(xs: number[], ys: number[]): {
  n: number;
  r: number;
  rSquared: number;
  slope: number;
  intercept: number;
  tStat: number;
  df: number;
  pValue: number;
  summary: string;
};

export function calculateSampleSizePower(opts: { effectSizeD: number; alpha?: number; power?: number }): {
  effectSizeD: number;
  alpha: number;
  power: number;
  perGroupN: number;
  totalN: number;
  formula: string;
};

export function generatePublicationSvgChart(opts: {
  kind?: "bar" | "scatter" | "line";
  title?: string;
  xLabel?: string;
  yLabel?: string;
  labels?: string[];
  values?: number[];
  errors?: number[];
  xValues?: number[];
  yValues?: number[];
  secondaryValues?: number[];
  primaryName?: string;
  secondaryName?: string;
}): string;
