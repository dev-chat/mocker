export interface QuoteResponse {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export interface MetricResponse {
  series: MetricResponseSeries;
  metric: Metric;
  metricType: string;
  symbol: string;
}

export interface MetricResponseSeries {
  annual: MetricResponseSeriesAnnual;
}

export interface MetricResponseSeriesAnnual {
  currentRatio: MetricResponseSeriesAnnualCurrentRatio[];
  salesPerShare: MetricResponseSeriesAnnualSalesPerShare[];
  netMargin: MetricResponseSeriesAnnualNetMargin[];
}

export interface MetricResponseSeriesAnnualCurrentRatio {
  period: string;
  v: number;
}

export interface MetricResponseSeriesAnnualSalesPerShare {
  period: string;
  v: number;
}

export interface MetricResponseSeriesAnnualNetMargin {
  period: string;
  v: number;
}

export interface Metric {
  '10DayAverageTradingVolume': number;
  '52WeekHigh': number;
  '52WeekLow': number;
  '52WeekLowDate': string;
  '52WeekPriceReturnDaily': number;
  beta: number;
}

export interface CompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
  logo: string;
  finnhubIndustry: string;
}

export interface QuoteData {
  open: string;
  high: string;
  low: string;
  close: string;
  delta: string;
  deltaPercent: string;
  dayChange: string;
  dayChangePercent: string;
  prevClose: string;
  marketCap: number;
  lastRefreshed: Date;
  '52WeekHigh': string;
  '52WeekLow': string;
  ticker: string;
  name: string;
}
