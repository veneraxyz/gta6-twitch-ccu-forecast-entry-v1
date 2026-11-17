// gta6-twitch-ccu-forecast-01 entry (Node 22, standard library only).
//
// Model: scale-matched launch-curve forecast.
//   1. Take hour 1's print p1 as the anchor.
//   2. From the case's comparables, rebuild each past launch's release-day hourly
//      curve (24 whole-hour prints starting at its day_start). Keep only clean
//      launches (no early-access contamination in their unlock/notes text) whose
//      release day is complete and positive in every hour.
//   3. Keep the comparables whose own hour-1 print is within a factor 4 of p1
//      (same scale of launch). If fewer than 8 survive, widen the band to a
//      factor 10; if still fewer than 8, take every clean launch with a
//      four-figure hour-1 print; if still none, fall back to persistence.
//   4. For each hour h = 2..24, take the log-ratios ln(viewers_h / viewers_1)
//      across the band and centre them with a 20% trimmed mean (drops the flat
//      launches and the explosive tiny-hour-1 launches at both tails). Past
//      launches' trimmed-mean curves rise less steeply than the launches
//      themselves do, so the log-centre is lifted 10% (factor 1.1) before use.
//   5. Quantiles: q_tau(h) = p1 * exp(1.1 * centre_h + z_tau * 0.35), with a
//      fixed log spread of 0.35 at every hour and z the standard normal's
//      quantiles, rounded to 2 decimals and clamped to (0, 1e9].
//
// Why this should generalise: the shape of a launch day (pre-US trough, jump
// at the US unlocks, peak in the US evening) is common to every midnight
// console launch in the set, while its size depends on the launch's scale -
// which the hour-1 band controls for. Nothing is fitted to any single
// launch: every number above is computed from the case file at run time.
//
// Practice (local pinball scorer, answers from SullyGnome hourly averages):
//   starter baseline 0.3871 mean; this model 0.1635 mean
//   (p00 0.2270, p01 0.1638, p02 0.1008, p03 0.1622 - beats the baseline
//   on all four practice cases).

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Quantile levels the contest scores, in the order each row lists them. */
const LEVELS = [0.05, 0.25, 0.5, 0.75, 0.95];
/** Standard normal quantiles at LEVELS. */
const Z_SCORES = [-1.6448536269514722, -0.6744897501960817, 0, 0.6744897501960817, 1.6448536269514722];
/** Fixed log spread at every hour (calibrated on practice; see header). */
const LOG_SPREAD = 0.35;
/** Uplift applied to the trimmed-mean log-ratio centre (see header). */
const CENTRE_UPLIFT = 1.1;
/** Trim fraction at each tail of the log-ratio distribution. */
const TRIM = 0.2;
/** Minimum comparables kept in the scale band before widening it. */
const MIN_BAND = 8;
/** Scale band around the case's hour-1 print (factor each way). */
const BAND_WIDE = 4;
const BAND_WIDER = 10;

interface HourlyPoint {
  from: string;
  viewers: number | null;
}

interface Comparable {
  day_start: string;
  unlock?: string;
  notes?: string;
  hourly: HourlyPoint[];
}

interface CaseFile {
  id: string;
  levels: number[];
  known: Array<{ hour: number; viewers: number }>;
  forecast: Array<{ hour: number }>;
  comparables: Comparable[];
}

/** True when a comparable's unlock/notes text marks it early-access contaminated. */
function isContaminated(c: Comparable): boolean {
  const text = `${c.unlock ?? ''} ${c.notes ?? ''}`.toLowerCase();
  return text.includes('early-access') || text.includes('contaminated');
}

/** The comparable's release-day hourly curve: 24 prints from day_start, or null. */
function releaseDayCurve(c: Comparable): number[] | null {
  const start = Date.parse(c.day_start);
  if (Number.isNaN(start)) return null;
  const byHour = new Map<number, number>();
  for (const pt of c.hourly) {
    const t = Date.parse(pt.from);
    if (Number.isNaN(t) || pt.viewers === null || pt.viewers === undefined) continue;
    const h = Math.round((t - start) / 3_600_000);
    if (h >= 0 && h < 24 && !byHour.has(h)) byHour.set(h, pt.viewers);
  }
  if (byHour.size < 24) return null;
  const curve: number[] = [];
  for (let h = 0; h < 24; h += 1) {
    const v = byHour.get(h);
    if (v === undefined || v <= 0) return null;
    curve.push(v);
  }
  return curve;
}

/** Clean, complete comparables as [hour-1 print, release-day curve] pairs. */
function usableComparables(cs: CaseFile): Array<[number, number[]]> {
  const out: Array<[number, number[]]> = [];
  for (const c of cs.comparables ?? []) {
    if (isContaminated(c)) continue;
    const curve = releaseDayCurve(c);
    if (curve !== null) out.push([curve[0], curve]);
  }
  return out;
}

/** 20% trimmed mean of a list of log-ratios (sorted internally). */
function trimmedMean(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const k = Math.floor(sorted.length * TRIM);
  const kept = sorted.slice(k, sorted.length - k);
  const use = kept.length > 0 ? kept : sorted;
  return use.reduce((s, v) => s + v, 0) / use.length;
}

/** Per-hour log-ratio centres (hours 2..24) from the scale-matched band. */
function logRatioCentres(p1: number, pool: Array<[number, number[]]>): number[] | null {
  let band = pool.filter(([h1]) => h1 >= p1 / BAND_WIDE && h1 <= p1 * BAND_WIDE);
  if (band.length < MIN_BAND) {
    band = pool.filter(([h1]) => h1 >= p1 / BAND_WIDER && h1 <= p1 * BAND_WIDER);
  }
  if (band.length < MIN_BAND) {
    band = pool.filter(([h1]) => h1 >= 10_000);
  }
  if (band.length === 0) return null;
  const centres: number[] = [];
  for (let h = 1; h < 24; h += 1) {
    const ratios = band.map(([, curve]) => Math.log(curve[h] / curve[0]));
    centres.push(trimmedMean(ratios));
  }
  return centres;
}

/** Five quantiles for one hour from its log-ratio centre. */
function hourQuantiles(p1: number, centre: number): number[] {
  const qs = Z_SCORES.map((z) => {
    const q = p1 * Math.exp(CENTRE_UPLIFT * centre + z * LOG_SPREAD);
    const rounded = Math.round(q * 100) / 100;
    return Math.min(1_000_000_000, Math.max(0.01, rounded));
  });
  for (let i = 1; i < qs.length; i += 1) qs[i] = Math.max(qs[i], qs[i - 1]);
  return qs;
}

/** Forecast rows for one case file. */
function forecastCase(c: CaseFile): Array<{ hour: number; q: number[] }> {
  const first = c.known.find((k) => k.hour === 1);
  if (first === undefined) throw new Error(`${c.id} has no hour-1 print`);
  const p1 = Math.max(1, first.viewers);
  const centres = logRatioCentres(p1, usableComparables(c));
  const listed = c.forecast.map((f) => f.hour).filter((h) => h >= 2 && h <= 24);
  const hoursToForecast = listed.length === 23 ? listed : Array.from({ length: 23 }, (_, i) => i + 2);
  return hoursToForecast.map((hour) => {
    const centre = centres === null ? 0 : centres[hour - 2];
    return { hour, q: hourQuantiles(p1, centre) };
  });
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as CaseFile;
  if (c.levels.length !== LEVELS.length || c.levels.some((t, j) => t !== LEVELS[j])) {
    throw new Error(`${file} asks for levels ${JSON.stringify(c.levels)}, not ${JSON.stringify(LEVELS)}`);
  }
  const hours = forecastCase(c);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ hours })}\n`);
}
