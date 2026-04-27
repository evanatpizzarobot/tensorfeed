import { Env } from './types';

/**
 * Premium forecast.
 *
 * Conservative statistical forecast for AI model price and benchmark
 * trajectories, based on the last N days of daily snapshots captured by
 * Phase 0 history.
 *
 * Method: linear least-squares regression on the historical points,
 * extrapolated forward by `horizon` days, with a confidence interval
 * derived from the residual standard error. We DO NOT pretend this is a
 * reliable predictor; the response includes explicit "this is statistical
 * inference, not a guarantee" disclaimers and a confidence number that
 * reflects how clean the historical signal actually is.
 *
 * Cost: 2 credits per call. More compute and higher per-call value than
 * the Tier 1 series endpoints; agents only need to call this when they
 * are actually planning around future state.
 */

const MIN_LOOKBACK_DAYS = 7;
const DEFAULT_LOOKBACK_DAYS = 30;
const MAX_LOOKBACK_DAYS = 90;

const MIN_HORIZON_DAYS = 1;
const DEFAULT_HORIZON_DAYS = 7;
const MAX_HORIZON_DAYS = 30;

const MIN_DATA_POINTS_FOR_FIT = 4;

// === KV shapes (mirror of history.ts) ===

interface HistorySnapshot<T = unknown> {
  date: string;
  type: string;
  capturedAt: string;
  data: T;
}

interface ModelPricing {
  id: string;
  name: string;
  inputPrice: number;
  outputPrice: number;
}

interface ProviderPricing {
  id: string;
  name: string;
  models: ModelPricing[];
}

interface PricingPayload {
  providers: ProviderPricing[];
}

interface BenchmarkModelEntry {
  model: string;
  provider: string;
  scores: Record<string, number>;
}

interface BenchmarksPayload {
  models: BenchmarkModelEntry[];
}

// === Date helpers ===

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  const span = Math.round((b - a) / (1000 * 60 * 60 * 24));
  for (let i = 0; i <= span; i++) out.push(addDays(from, i));
  return out;
}

// === Statistical core ===

interface FitResult {
  slope: number;
  intercept: number;
  rSquared: number;
  residualStdError: number;
  n: number;
}

/**
 * Linear least-squares fit on (xIndex, y) pairs. Returns the slope,
 * intercept, R squared (0-1), and residual standard error so we can
 * compute prediction intervals.
 */
function linearFit(points: { x: number; y: number }[]): FitResult | null {
  const n = points.length;
  if (n < MIN_DATA_POINTS_FOR_FIT) return null;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  if (den === 0) {
    // All x identical, or only one unique x; flat slope is the only option
    return { slope: 0, intercept: meanY, rSquared: 0, residualStdError: 0, n };
  }
  const slope = num / den;
  const intercept = meanY - slope * meanX;

  let ssTot = 0;
  let ssRes = 0;
  for (const p of points) {
    const yhat = slope * p.x + intercept;
    ssTot += (p.y - meanY) ** 2;
    ssRes += (p.y - yhat) ** 2;
  }
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const residualStdError = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
  return { slope, intercept, rSquared, residualStdError, n };
}

function round4(n: number): number {
  return parseFloat(n.toFixed(4));
}

/**
 * Confidence label and numeric score in [0, 1] derived from the fit.
 * Combines R squared (signal strength) with sample size penalty.
 */
function confidence(fit: FitResult): { score: number; label: 'low' | 'medium' | 'high' } {
  const sizePenalty = Math.min(1, fit.n / 30);
  const score = Math.max(0, Math.min(1, fit.rSquared * sizePenalty));
  let label: 'low' | 'medium' | 'high' = 'low';
  if (score >= 0.7) label = 'high';
  else if (score >= 0.4) label = 'medium';
  return { score: round4(score), label };
}

// === KV access ===

async function readPricingHistory(
  env: Env,
  from: string,
  to: string,
): Promise<{ date: string; payload: PricingPayload }[]> {
  const dates = enumerateDates(from, to);
  const records = await Promise.all(
    dates.map(async date => ({
      date,
      snapshot: (await env.TENSORFEED_CACHE.get(
        `history:${date}:models`,
        'json',
      )) as HistorySnapshot<PricingPayload> | null,
    })),
  );
  return records
    .filter((r): r is { date: string; snapshot: HistorySnapshot<PricingPayload> } => r.snapshot !== null)
    .map(r => ({ date: r.date, payload: r.snapshot.data }));
}

async function readBenchmarkHistory(
  env: Env,
  from: string,
  to: string,
): Promise<{ date: string; payload: BenchmarksPayload }[]> {
  const dates = enumerateDates(from, to);
  const records = await Promise.all(
    dates.map(async date => ({
      date,
      snapshot: (await env.TENSORFEED_CACHE.get(
        `history:${date}:benchmarks`,
        'json',
      )) as HistorySnapshot<BenchmarksPayload> | null,
    })),
  );
  return records
    .filter((r): r is { date: string; snapshot: HistorySnapshot<BenchmarksPayload> } => r.snapshot !== null)
    .map(r => ({ date: r.date, payload: r.snapshot.data }));
}

// === Series extraction ===

function extractPriceSeries(
  history: { date: string; payload: PricingPayload }[],
  modelKey: string,
  field: 'inputPrice' | 'outputPrice' | 'blended',
): { date: string; value: number }[] {
  const k = modelKey.toLowerCase();
  const out: { date: string; value: number }[] = [];
  for (const { date, payload } of history) {
    if (!payload?.providers) continue;
    let found: ModelPricing | null = null;
    for (const p of payload.providers) {
      const m = p.models.find(
        m2 => m2.id.toLowerCase() === k || m2.name.toLowerCase() === k,
      );
      if (m) {
        found = m;
        break;
      }
    }
    if (!found) continue;
    const value =
      field === 'blended'
        ? (found.inputPrice + found.outputPrice) / 2
        : (found[field] as number);
    if (Number.isFinite(value)) out.push({ date, value });
  }
  return out;
}

function extractBenchmarkSeries(
  history: { date: string; payload: BenchmarksPayload }[],
  modelKey: string,
  benchmark: string,
): { date: string; value: number }[] {
  const mk = modelKey.toLowerCase();
  const bk = benchmark.toLowerCase();
  const out: { date: string; value: number }[] = [];
  for (const { date, payload } of history) {
    const entry = (payload?.models ?? []).find(m => m.model.toLowerCase() === mk);
    if (!entry?.scores) continue;
    const matchKey = Object.keys(entry.scores).find(k => k.toLowerCase() === bk);
    if (!matchKey) continue;
    const value = entry.scores[matchKey];
    if (Number.isFinite(value)) out.push({ date, value });
  }
  return out;
}

// === Public types ===

export type ForecastTarget = 'price' | 'benchmark';
export type PriceField = 'inputPrice' | 'outputPrice' | 'blended';

export interface ForecastOptions {
  target: ForecastTarget;
  model: string;
  /** Required when target is 'price'. */
  field?: PriceField;
  /** Required when target is 'benchmark'. */
  benchmark?: string;
  /** Days of history to fit on. Default 30, max 90, min 7. */
  lookback?: number;
  /** Days into the future to project. Default 7, max 30, min 1. */
  horizon?: number;
}

export interface ForecastPoint {
  date: string;
  predicted: number;
  lower: number;
  upper: number;
}

export interface ForecastResult {
  ok: true;
  target: ForecastTarget;
  model: string;
  field?: PriceField;
  benchmark?: string;
  fitted_on: { from: string; to: string; days: number; data_points: number };
  horizon_days: number;
  current_value: number;
  trend: { slope_per_day: number; r_squared: number };
  confidence: { score: number; label: 'low' | 'medium' | 'high' };
  forecast: ForecastPoint[];
  notes: string[];
}

export interface ForecastError {
  ok: false;
  error: string;
  reason?: string;
}

// === Top-level entry ===

export async function computeForecast(
  env: Env,
  options: ForecastOptions,
): Promise<ForecastResult | ForecastError> {
  if (options.target !== 'price' && options.target !== 'benchmark') {
    return { ok: false, error: 'invalid_target', reason: 'target must be price or benchmark' };
  }
  if (typeof options.model !== 'string' || !options.model.trim()) {
    return { ok: false, error: 'model_required' };
  }
  if (options.target === 'price') {
    const f = options.field;
    if (f !== 'inputPrice' && f !== 'outputPrice' && f !== 'blended') {
      return { ok: false, error: 'price_field_required' };
    }
  }
  if (options.target === 'benchmark') {
    if (typeof options.benchmark !== 'string' || !options.benchmark.trim()) {
      return { ok: false, error: 'benchmark_required' };
    }
  }

  const lookback = Math.max(
    MIN_LOOKBACK_DAYS,
    Math.min(options.lookback ?? DEFAULT_LOOKBACK_DAYS, MAX_LOOKBACK_DAYS),
  );
  const horizon = Math.max(
    MIN_HORIZON_DAYS,
    Math.min(options.horizon ?? DEFAULT_HORIZON_DAYS, MAX_HORIZON_DAYS),
  );

  const today = todayUTC();
  const from = addDays(today, -(lookback - 1));

  // Pull history and extract the (date, value) series
  let series: { date: string; value: number }[];
  if (options.target === 'price') {
    const hist = await readPricingHistory(env, from, today);
    series = extractPriceSeries(hist, options.model, options.field as PriceField);
  } else {
    const hist = await readBenchmarkHistory(env, from, today);
    series = extractBenchmarkSeries(hist, options.model, options.benchmark!);
  }

  if (series.length < MIN_DATA_POINTS_FOR_FIT) {
    return {
      ok: false,
      error: 'insufficient_history',
      reason: `Need at least ${MIN_DATA_POINTS_FOR_FIT} historical data points; found ${series.length} in the requested ${lookback}-day window. Try a longer lookback or wait for more snapshots to accumulate.`,
    };
  }

  // Convert dates to numeric x indices (days since the first sample)
  const firstDate = series[0].date;
  const firstMs = new Date(`${firstDate}T00:00:00Z`).getTime();
  const points = series.map(s => ({
    x: Math.round((new Date(`${s.date}T00:00:00Z`).getTime() - firstMs) / (1000 * 60 * 60 * 24)),
    y: s.value,
  }));

  const fit = linearFit(points);
  if (!fit) {
    return { ok: false, error: 'fit_failed' };
  }

  const conf = confidence(fit);
  const lastPoint = series[series.length - 1];
  const lastX = points[points.length - 1].x;

  // 95% prediction interval scales with residual std error
  const ciWidth = 1.96 * fit.residualStdError;
  const forecast: ForecastPoint[] = [];
  for (let i = 1; i <= horizon; i++) {
    const x = lastX + i;
    const predicted = fit.slope * x + fit.intercept;
    forecast.push({
      date: addDays(today, i),
      predicted: round4(predicted),
      lower: round4(predicted - ciWidth),
      upper: round4(predicted + ciWidth),
    });
  }

  const notes: string[] = [
    'Statistical inference, not a guarantee. The forecast assumes the underlying trend continues; price and benchmark changes are typically driven by discrete events (model launches, pricing announcements) which this model cannot anticipate.',
    `Confidence label is "${conf.label}" with score ${conf.score}. Treat low-confidence forecasts as "no signal" rather than a directional call.`,
    'Prediction interval is 95% based on residual standard error from the linear fit.',
  ];
  if (conf.label === 'low') {
    notes.push('Low confidence usually means the historical data is flat (no recent changes) or noisy. The forecast falls back near the current value.');
  }

  return {
    ok: true,
    target: options.target,
    model: options.model,
    ...(options.target === 'price' ? { field: options.field as PriceField } : {}),
    ...(options.target === 'benchmark' ? { benchmark: options.benchmark } : {}),
    fitted_on: {
      from,
      to: today,
      days: lookback,
      data_points: series.length,
    },
    horizon_days: horizon,
    current_value: round4(lastPoint.value),
    trend: {
      slope_per_day: round4(fit.slope),
      r_squared: round4(fit.rSquared),
    },
    confidence: conf,
    forecast,
    notes,
  };
}
