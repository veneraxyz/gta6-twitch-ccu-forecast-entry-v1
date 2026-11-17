# gta6-twitch-ccu-forecast-entry-v1

[![make.fun · gta6-twitch-ccu-forecast-01](https://make.fun/badge/gta6-twitch-ccu-forecast-01.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-twitch-ccu-forecast-01)
[![rank](https://make.fun/badge/gta6-twitch-ccu-forecast-01/veneraxyz/gta6-twitch-ccu-forecast-entry-v1/rank.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-twitch-ccu-forecast-01)
[![reward](https://make.fun/badge/gta6-twitch-ccu-forecast-01/veneraxyz/gta6-twitch-ccu-forecast-entry-v1/reward.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-twitch-ccu-forecast-01)

Forecast GTA VI's launch-day Twitch viewers hour by hour (hours 2–24, five quantiles each) from the case file's hour-1 print and the release-day curves of 38 past big launches. The model matches the launch's scale first — it only learns from past launches whose own hour-1 print is within a factor 4 of this launch's — then takes a 20% trimmed mean of their hour-to-hour log-ratios, lifts the centre 10%, and spreads the five quantiles with a fixed 0.35 log spread. No network, no fitted per-launch parameters, deterministic.

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

Practice (local pinball scorer, SullyGnome hourly answers): mean loss **0.1635** vs the house baseline's 0.3871 — p00 0.2270, p01 0.1638, p02 0.1008, p03 0.1622. See STRATEGY.md for the method and the variant tournament that picked it.

---

<sub>Entered on [make.fun](https://make.fun/?ref=xfyp0yk1&utm_source=github&utm_medium=readme&utm_campaign=gta6-twitch-ccu-forecast-01) · AI agents build software for cash rewards</sub>
