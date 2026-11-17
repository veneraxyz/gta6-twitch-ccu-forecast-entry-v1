# Strategy — scale-matched launch-curve forecast

## What the program does

`main.ts` (Node 22, stdlib only, ~0.17 s per case, deterministic) forecasts
hours 2–24 of the release day as five log-normal quantiles around hour 1's
print `p1`:

1. **Rebuild past launches.** From each comparable in the case file, extract
   its release-day hourly curve (24 prints from its `day_start`). Keep only
   clean launches — no early-access contamination in the unlock/notes text —
   with a complete, all-positive release day. (The GTA VI category's own
   pre-release history has no release-day hour 1, so it drops out by itself.)
2. **Match the scale.** Keep the comparables whose hour-1 print lies within
   a factor 4 of `p1`. A launch's day-shape depends on its scale: tiny
   hour-1 launches explode by 100x+, big launches move 2–3x. Fallbacks if
   fewer than 8 survive: widen to a factor 10, then all clean launches with
   a four-figure hour-1 print, then persistence (centre 0).
3. **Centre = trimmed mean of log-ratios.** For each hour, take
   `ln(viewers_h / viewers_1)` across the band and centre with a 20%
   trimmed mean — it drops the flat launches and the explosive ones at both
   tails, and uses the distribution more efficiently than the median.
4. **Lift 10%.** Multiply the log-centre by 1.1: the trimmed mean of past
   launches rises less steeply than launches actually do (their curves are
   right-skewed; the median launch peaks higher than the median ratio).
5. **Fixed spread.** `q_tau = p1 * exp(1.1 * centre_h + z_tau * 0.35)` with
   a constant 0.35 log spread at every hour. Empirical per-hour spreads
   from the comparables are far too wide (heavy right tail) and cost loss at
   every hour; the fixed spread beat them on practice.

## Why it should generalise to the unseen final

- The day-shape (pre-US trough in hours 2–4, jump at the 05:00/08:00 UTC US
  unlocks, peak in the US evening, gentle decline) is common to every
  midnight console launch in the set; only its size varies, and the scale
  band controls for that.
- Nothing is fitted to any single launch: every number is computed from the
  case file at run time. The final case ships 42 comparables (the 4 practice
  launches included); the same code path uses them.
- The two tuned constants (1.1 lift, 0.35 spread) were picked on the mean
  across all four practice cases and improve every case individually, not
  one outlier.

## Practice results (local pinball scorer, exact RULES formula)

| variant | mean | p00 Wolverine | p01 RDR2 | p02 GoW | p03 Spider-Man 2 |
|---|---|---|---|---|---|
| house baseline (starter) | 0.3871 | 0.7436 | 0.2868 | 0.2146 | 0.3033 |
| median ratio + baseline spread | 0.2490 | 0.3412 | 0.1487 | 0.2434 | 0.2627 |
| median ratio + IQR spread, scale band | 0.2028 | 0.3226 | 0.1611 | 0.1401 | 0.1875 |
| trimmed mean + IQR spread, scale band | 0.1911 | 0.2687 | 0.1701 | 0.1427 | 0.1830 |
| **trimmed mean + fixed 0.35 + 1.1 lift (submitted)** | **0.1635** | **0.2270** | **0.1638** | **0.1008** | **0.1622** |

Beats the baseline on all four practice cases, mean 58% lower. Practice
answers were taken from SullyGnome hourly averages anchored to each case's
hour-1 print (verified against each case's history tail); the scorer
reproduces the starter's published ~0.387 exactly.

## Risks

- The final's hour-1 print is unknown; if it lands above ~600k the scale
  band thins (6 comparables) and the widen-to-10x fallback engages — the
  code handles it, but the centre is then estimated from fewer launches.
- Practice is no guide to the final except as validation (RULES): the
  house superbot answers the same ratio-plus-spread family, so the prize
  bar is whichever house entry scores lower on the final, not the 0.387
  baseline alone.
