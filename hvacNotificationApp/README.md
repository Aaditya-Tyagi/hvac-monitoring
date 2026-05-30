# HVAC Monitor

A React Native (Expo) Android app that replaces a noisy threshold-based HVAC alert system with a multi-layer anomaly detector that earns the maintenance team's trust back.

The story for this build is documented in `/Users/macbook/.claude/plans/luminous-gathering-yao.md` — the why, the detection design, the architecture-evolution table for the script, and the per-screen breakdown. **Read that first** if you want the rationale.

---

## Table of contents

- [The problem](#the-problem)
- [The three core ideas](#the-three-core-ideas)
- [Run the demo](#run-the-demo)
- [Run the engine tests (no device needed)](#run-the-engine-tests-no-device-needed)
- [How a sensor reading flows through the app](#how-a-sensor-reading-flows-through-the-app)
- [The engine, in depth](#the-engine-in-depth)
- [The screens](#the-screens)
- [State management](#state-management)
- [Folder layout](#folder-layout)
- [Build vs script narrative](#build-vs-script-narrative)

---

## The problem

A factory has 5 air conditioners (HVACs). Each one streams 5 numbers every 5 minutes — temperature, pressure, airflow, vibration, power. The old alert system was dumb: "if temp > 30, beep." It beeped wrong 90% of the time. Technicians got tired, started ignoring beeps. Two ACs broke last quarter while the team was busy ignoring the beeps. They want something smarter that **only beeps when it should**, and **says why** when it does.

We built a phone app that watches the 5 ACs, decides what's actually wrong, and pings the technician only for real problems — with a one-line explanation.

---

## The three core ideas

### 1. "Trust" is the product, not "detection"

The technicians don't have a detection problem. They have a *trust* problem. They stopped trusting alerts because alerts didn't say *why*. So everything in the app is shaped around that one observation:

- Every alert carries a human-readable reason ("Vibration 3× normal, sustained 25 min").
- Every alert has a confidence percentage.
- The user can tap "False alarm" — and the system actually listens, getting less sensitive on that unit.
- The Unit Detail screen shows the **raw data first** with a peer-median reference line, and the system verdict only appears when you toggle to "System analysis". The technician sees the data before they see our conclusion.

### 2. The smart bit (engine) runs separately from the app bit (screens)

The detection logic is a plain TypeScript file with **zero React Native in it**. It's just math on arrays. This means:

- It runs inside the app on the phone (the demo).
- It also runs inside `npx vitest run` on your laptop (the tests).
- It could run inside a Node server (the production story for the script).

Same code, three places. We didn't pick this because it's clever — we picked it because we wanted to test the math in 200ms instead of rebuilding an APK every 10 minutes.

### 3. The CSV is bundled and "replayed" as if it were live

There's no backend. The 1000 rows of sensor data are inside the APK. When the app starts, a thing called `CsvReplayDataSource` reads the file and pretends each row is arriving live, one tick at a time. Default tick = 400ms = 1 simulated reading every 400ms. So the full 16-hour shift "plays" in about 30 seconds.

In production, you'd swap this for a `WebSocketDataSource` that reads from your real backend. The rest of the app doesn't know or care which one is providing data.

---

## Run the demo

```bash
# 1. Install deps (if you've just cloned)
npm install

# 2. Generate / refresh the Android native project (already done once; re-run after lib upgrades)
npx expo prebuild --platform android

# 3. Build + launch on an Android emulator or attached device
npx expo run:android
```

Notes on the build:

- **Android only.** iOS is not configured for this eval.
- A custom dev client is required (MMKV is native). Expo Go won't work.
- First `expo run:android` takes ~5–10 minutes because Gradle builds the world.

---

## Run the engine tests (no device needed)

```bash
npx vitest run
```

These exercise the pure detection engine against the real bundled CSV. They assert the four scenarios the design rests on:

- **HVAC_1** — gradual OK → WATCH → ACT across the day.
- **HVAC_2** — single-reading ACT via hard override on row 51.
- **HVAC_3** — stays OK despite 33 anomalous-looking pressure readings (deceptive data per the brief).
- **HVAC_4** — never alerts despite ~55 missing temperature and ~56 missing airflow readings.

---

## How a sensor reading flows through the app

This is the entire pipeline. Six steps. Follow it once and you know how the codebase works.

```
1. CsvReplayDataSource reads one CSV row
            ▼
2. emits a Reading { ts, unitId, temp, pressure, airflow, vibration, power }
            ▼
3. runtime.ts receives it, pushes it into RingBuffer (last 60 readings per unit)
            ▼
4. runtime.ts calls evaluate(window, peers, metadata, config) — the engine
            ▼
5. engine returns DetectionResult { status, confidence, contributing sensors, reasons }
            ▼
6. result goes into FleetStore (Zustand) → screens re-render → maybe notification fires
```

Repeat 1000 times per replay.

---

## The engine, in depth

This is the only "interesting" part. Everything else is plumbing. Open `src/detection/engine.ts` alongside this section.

### What an engine call looks like

Every 400ms (one simulated 5-minute tick), the runtime hands the engine one reading and asks "what's the status of this unit right now?"

```ts
evaluate({
  unitId: 'HVAC_2',
  window: [...last 60 readings for HVAC_2, oldest to newest],
  peers: [latest reading from each of the other 4 units],
  metadata: { installDate, area, lastServiceDate, ... },
  config: { thresholds, weights, floor_std, ... },
  state: { baseline, severityHistory, consecutiveAnomalous, ... }
})
```

The engine reads from these inputs, mutates `state` (so it remembers across calls), and returns a `DetectionResult`. **No globals, no side effects beyond `state` mutation.** That's why the same code runs in tests and in production — it's a pure function with one parameter that acts as memory.

### What `state` holds (and why)

Per unit, we keep:

- `baseline.<sensor>` — `{mean, std}` per sensor, *frozen* after the first 24 readings
- `baselineReady` — has the cold-start window finished?
- `severityHistory` — last 5 severity scores (for smoothing the gradual track)
- `peerSeverityHistory` — last 5 peer-deviation scores (same purpose)
- `consecutiveAnomalous` — count of consecutive readings where severity > 0.4
- `recentHotPerSensor` / `recentHotRing` — which sensors have been "hot" in the last 10 readings (for the diversity gate)

Without state, every reading would be evaluated in isolation, and we'd never detect drift.

---

### The two failure modes that drive the design

The dataset contains two completely different kinds of broken AC:

- **HVAC_1** breaks **slowly**. Vibration drifts up over hours. No single reading looks scary. By the time vibration looks "high," the unit's been failing for hours. A simple "vibration > 0.1" threshold catches this only after it's catastrophic.
- **HVAC_2** breaks for **one reading**. At 4:10am, three sensors go wild simultaneously, then the next reading is normal again. A "wait for sustained anomaly" system would filter this out as noise. But it's a real event.

These two failure modes need *opposite* strategies. One needs patience (don't fire until it persists). The other needs urgency (fire on one reading). That's why we have **two tracks**.

---

### Step 1: Cold start — "I don't know what normal is yet"

```ts
updateBaseline(state, window, config);
if (!state.baselineReady) {
  return { status: 'UNKNOWN', reasonCodes: ['cold_start'] };
}
```

For the first 24 readings (2 hours of simulated time), the engine returns **UNKNOWN** for that unit and does nothing else. No alerts. The UI shows a grey pill.

Why 24 readings? To detect anomalies you need to know what normal looks like, and "normal" is `mean ± std` of healthy operating values. With fewer than ~20 samples, your `std` estimate is too noisy. 24 readings = 2 hours = enough samples to lock in a stable baseline.

Once we have 24 readings, we compute `mean` and `std` per sensor from those 24 values and **freeze them**. They never change for the rest of the session.

**Why freeze?** Because HVAC_1 degrades *gradually*. If we kept rolling the baseline as new readings came in, the baseline would slowly drift up *with* the degradation, and a vibration of 0.13 (way out of normal) would look "only slightly above baseline" by the time we got there. The frozen baseline keeps shouting "this isn't what you looked like at hour 1."

The trade-off: if a unit has a legitimate long-term shift (seasonal, post-maintenance), the frozen baseline would over-flag. In production you'd re-snapshot the baseline manually after service. For the eval we don't need that.

---

### Step 2: Score each sensor — three z-scores, blended

For each sensor (`temp`, `pressure`, `airflow`, `vibration`, `power`) on the current reading, we compute *two* deviation measurements and take the worse of the two.

#### 2a. Baseline z-score — "vs this unit's own history"

```ts
baselineZ = (currentValue − baselineMean) / max(baselineStd, floor_std)
```

The classic "how many standard deviations from the mean is this?" Higher absolute value → more anomalous. z=2 is mildly weird. z=4 is very weird. z=10 is essentially impossible under normal operation.

#### 2b. Peer z-score — "vs the other 4 units right now"

```ts
peerMedian  = median of the other 4 units' latest reading for this sensor
peerSpread  = MAD (Median Absolute Deviation) of those 4 values × 1.4826
peerZ       = (currentValue − peerMedian) / max(peerSpread, floor_std)
```

Peer comparison is the *insurance* against the frozen-baseline problem. Imagine a building-wide event raises all 5 units' temperatures (outside air got hot). Baseline z would flag everyone. But peer z compares each unit to the others — if all 5 are equally up, peer z = 0 and nothing fires.

**Why median + MAD, not mean + std?** Because we have only 4 peers, and one of them might be the anomalous one. Median ignores the outlier; mean would be pulled toward it. MAD is the robust equivalent of std — it gives you the "spread" without being thrown off by one bad value. The `× 1.4826` factor scales MAD so it's comparable to std under a normal distribution.

#### 2c. Combine into one sensor score

```ts
sensorScore = clamp01( max(|baselineZ|, |peerZ|) / 5.0 )
```

We take whichever deviation is bigger (the loud one). Divide by 5 so z=5σ → score 1.0 (maxed out), z=3 → 0.6, z=2 → 0.4, z=1 → 0.2.

**Why divide by 5 and not 3?** Discovered through testing. With /3, a z=3 reading (which can happen on perfectly healthy sensors during routine variation) would saturate severity to 1.0 and trip ACT alone. HVAC_3's pressure dips have z's around 4 — clearly anomalous but not necessarily a system fault. /5 leaves headroom: even a z=4 reading gives severity 0.8, which fires WATCH but not ACT on its own.

#### The floor_std safety valve

You see `max(scale, floor_std)` in both z-score formulas. This is critical.

Consider a sensor on a healthy unit. The 24 baseline readings come in at 0.020, 0.022, 0.019, 0.021... all super tight. The computed std might be 0.0008 — a tiny number.

Now a new reading comes in at 0.025. That's 0.005 above the mean. Divided by std of 0.0008, z = 6.25. We'd say "extreme anomaly!" — but actually nothing's wrong, it's just normal noise on a quiet sensor.

The `floor_std` says: "no matter how small the actual std is, treat it as at least *this much*." For vibration, floor is 0.008. So even if true std is 0.0008, we divide by 0.008. Now z = 0.005/0.008 = 0.625. Sane.

The five floor values (`temp: 0.5, pressure: 0.07, airflow: 8, vibration: 0.008, power: 0.3`) were calibrated empirically from the healthy units in the dataset.

**This is the single most important defense against false alarms** the prior threshold system lacked. They'd compute z's against tiny denominators and fire constantly.

#### The MAD-collapse case

Same problem hits peer comparison too. If 3 of 4 peer units are reading exactly the same value (all healthy at vibration = 0.020), and the 4th is the wonky one (HVAC_1 at 0.13), the MAD calculation goes:

1. Median = 0.020
2. Absolute deviations from median: `[0, 0, 0, 0.11]`
3. Median of those = 0
4. MAD × 1.4826 = 0
5. Divide by 0 → infinity

The floor saves us here too — `max(0, 0.008) = 0.008`, sane denominator.

---

### Step 3: Roll up the sensor scores

```ts
severity      = max(sensorScores)
hotSignals    = count of sensors where sensorScore > 0.5
sigmaTripHits = count of sensors where |peerZ| > 4.0
```

- `severity` is "how loud is the loudest sensor?" — single number, 0–1.
- `hotSignals` is "how many sensors are simultaneously loud?" — 0 to 5.
- `sigmaTripHits` is "how many sensors are at extreme peer-z?" — feeds the hard override later.

---

### Step 4: The diversity gate — "system fault or sensor fault?"

The most subtle but important step.

```ts
state.recentHotRing.push(hotSensorsThisReading);
hotSensorDiversity = number of distinct sensors that have been hot in the last 10 readings
```

So `hotSensorDiversity` is "across the last 10 readings, how many *different* sensors have flagged as hot at any point?"

A real AC fault is physical. If bearings are worn, vibration goes up AND power goes up (motor working harder) AND airflow goes down (poor cooling). Three different sensors register the same underlying problem. Diversity ≥ 2.

But a **broken pressure sensor** reports wonky pressure values for hours straight. Only one sensor — pressure — is ever hot. Other sensors look fine. The AC itself is working perfectly. Diversity = 1.

Later in the engine:

```ts
const singleSensorOnly = hotSensorDiversity <= 1 && !hardOverride;
if (singleSensorOnly) status = 'OK';
```

If only one sensor has ever been hot and we don't have a hard override, **force status to OK regardless of confidence**.

This is what kept HVAC_3 quiet. HVAC_3 has a faulty pressure sensor in the dataset (33 readings with pressure well below 1.0). Those produced legit peer z's of ≈ −4 — mathematically anomalous. But only on pressure. The diversity gate said: "this is one sensor being weird, not the AC failing." Status stayed OK.

In production you'd want to surface "sensor anomaly" as its own category in the UI ("HVAC_3's pressure sensor needs calibration"). For the demo we just stay OK.

---

### Step 5: Correlation boost — "two screaming is worse than one"

```ts
correlationBoost = 0      if hotSignals < 2
                 = 0.15   if hotSignals == 2
                 = 0.30   if hotSignals >= 3
```

The additive penalty for multi-sensor anomalies. A real fault should affect multiple sensors. So if we see two or three sensors all hot at once, our confidence that *something is genuinely wrong* should rise sharply.

The numbers (0.15, 0.30) are tuning constants chosen so that:

- Two-sensor anomaly gets a meaningful but moderate boost.
- Three-or-more-sensor anomaly gets the maximum boost.
- The boost combined with a saturating severity (~1.0) can push acute confidence past the 0.80 ACT threshold.

---

### Step 6: Persistence — "have we seen this before?"

```ts
if (severity > 0.4) state.consecutiveAnomalous += 1;
else if (severity < 0.3) state.consecutiveAnomalous = 0;

persistenceFactor = min(state.consecutiveAnomalous / 5, 1.0);
```

A counter that increments when severity is anomalous (>0.4), resets when calm (<0.3), and has a sticky middle zone (0.3–0.4) where it just stays put.

Why the sticky middle? So a borderline reading doesn't whipsaw the counter up and down. The reset threshold is below the increment threshold deliberately.

After 5 consecutive anomalous readings (~25 simulated minutes), persistence is fully saturated. This is the gradual track's "have we been worried for a while?" signal.

---

### Step 7: Smoothing — "what's the recent trend?"

```ts
state.severityHistory.push(severity);          // keep last 5
state.peerSeverityHistory.push(peerSeverityNow);
severityAvg     = mean(state.severityHistory);
peerSeverityAvg = mean(state.peerSeverityHistory);
```

The gradual track shouldn't react to a single noisy reading. It should react to *consistently elevated readings*. So we average severity over the last 5. A one-reading blip averages with 4 calm readings → small bump. Five consecutive elevated readings → big bump.

---

### Step 8: The hard override — "this is unambiguous, fire immediately"

```ts
hardOverride = sigmaTripHits >= 2;  // ≥ 2 sensors at peer-z > 4σ
if (hardOverride) status = 'ACT';
```

**The single most important rule in the engine.** It bypasses everything else.

If two or more sensors are simultaneously more than 4σ off from peer median in *one* reading, we fire ACT *immediately*. No smoothing. No persistence. No diversity gate. Just fire.

Why? Because that's HVAC_2 at row 51. One reading. Three sensors all wildly off. The next reading is normal again. Without hard override, we'd never see this as an event — the persistence-based gradual track requires the signal to stick around, but this one didn't. By the time gradual confidence builds up, the event would be over.

4σ is a conservative threshold — almost never happens by chance. Combined with "must be two or more sensors at once," we're saying "the joint probability of these readings being random noise is essentially zero, so something definitely happened."

This is the engine's *insurance against false negatives* — the catastrophic kind of mistake.

---

### Step 9: Two confidence scores

Computed in parallel; we take the bigger.

#### Gradual confidence

```ts
gradualConfidence = clamp01(
  0.35 × severityAvg              // smoothed worst-sensor score
  + 0.35 × peerSeverityAvg        // smoothed peer deviation
  + correlationBoost              // 0 / 0.15 / 0.30 added directly
  + 0.10 × persistenceFactor      // weighted persistence
);
// Plus a metadata bump:
if (overdue for service) gradualConfidence += up to 0.10;
```

The weights (`0.35, 0.35, 0.30, 0.10`) say: severity matters about as much as peer deviation, correlation can add a lot when it kicks in, and persistence matters but doesn't dominate. Chosen so that:

- HVAC_1 Q3 (mid-decay) lands in WATCH range (~0.55–0.7).
- HVAC_1 Q4 (full degradation) saturates to ACT range (>0.80).
- HVAC_3/4/5 healthy never crosses 0.55.

#### Acute confidence

```ts
acuteRaw          = 0.75 × severity + correlationBoost;
needsConfirmation = !hardOverride && state.consecutiveAnomalous < 2;
acuteConfidence   = clamp01(needsConfirmation ? acuteRaw × 0.55 : acuteRaw);
```

Two important nuances:

1. **`× 0.75` cap on severity alone**: a single-sensor saturated severity (1.0) gives only 0.75 acute confidence — below the 0.80 ACT threshold. You need correlation_boost (≥0.05) to push past. So single-sensor extremes → WATCH, multi-sensor extremes → ACT.

2. **First-reading dampener (`× 0.55`)**: the *very first* time consecutiveAnomalous hits 1, we multiply by 0.55. So a single one-off blip never makes it past WATCH on the acute track, even with correlation. The second reading confirms or it dies out. **This is what kept HVAC_3 from firing WATCH on its random pressure dips.** Hard override bypasses this dampener.

#### Final confidence

```ts
confidence = max(gradualConfidence, acuteConfidence);
```

Whichever track is louder wins. Two completely different failure modes, both covered.

---

### Step 10: Decide the status

```ts
if (hardOverride)            status = 'ACT';
else if (singleSensorOnly)   status = 'OK';
else if (confidence >= 0.80) status = 'ACT';
else if (confidence >= 0.55) status = 'WATCH';
else                         status = 'OK';
```

In order:

1. Hard override wins above all (HVAC_2 case).
2. Single-sensor-only wonky → OK (HVAC_3 pressure case).
3. Otherwise, threshold-based: ≥0.80 = ACT, ≥0.55 = WATCH, lower = OK.
4. UNKNOWN is set earlier (cold start or too many missing sensors).

The thresholds 0.55 and 0.80 can be shifted by the sensitivity setting:

- **low**: 0.65 / 0.88 (harder to alert)
- **med**: 0.55 / 0.80 (default)
- **high**: 0.45 / 0.72 (easier to alert)

The trust loop adjusts these per-unit when the user marks false alarms.

---

### Step 11: Generate reason codes for the UI

```ts
reasonCodes = []
if (hardOverride)                  reasonCodes.push('hard_override');
if (correlationBoost > 0)          reasonCodes.push('multi_signal_correlation');
if (persistenceFactor >= 0.6)      reasonCodes.push('sustained_drift');
if (peerSeverityNow >= 0.7)        reasonCodes.push('peer_deviation');
if (top baseline z >= 2.5)         reasonCodes.push('baseline_deviation');
if (any sensor missing)            reasonCodes.push('missing_data');
if (service overdue >30 days)      reasonCodes.push('service_overdue_prior');
```

These get rendered as the chips on the Unit Detail screen. `src/detection/reasons.ts` turns them and the contributing sensor list into English bullets like:

> *"Vibration 0.13 g — 22σ from peer median"*
> *"Power 9.1 kW — 13σ from peer median"*
> *"Anomaly sustained across multiple consecutive readings."*

That's the "why" the technicians said they needed.

---

### Missing data handling

Sprinkled throughout the engine:

- If a sensor value is `null` → it's **excluded** from the score, not treated as zero. No false alarms from missing data.
- If **3 or more sensors are missing** in one reading → status is forced to `UNKNOWN`. Not enough signal.
- Peer median only uses peers with valid (non-null) readings — if fewer than 2 peers have a value for a sensor, peer comparison is skipped for that sensor.

HVAC_4 has ~55 missing temperature and ~56 missing airflow rows. The engine handles them silently — never fires false alerts because the remaining 3 sensors (pressure, vibration, power) are healthy and complete.

---

### Per-unit metadata as priors

The engine reads `UnitMetadata` (install date, area, last service date) for two adjustments:

#### Overdue-service bump

```ts
overdueFactor = clamp((daysSinceService − serviceIntervalDays) / 30, 0, 1);
gradualConfidence += 0.10 × overdueFactor;
```

If a unit is 30+ days overdue for service, gradual confidence gets up to +0.10. Not enough to fire ACT on its own — just a thumb on the scale that nudges WATCH thresholds a bit closer.

The intuition: a unit overdue for service is genuinely more likely to actually be failing. Bayesian-style prior. HVAC_1 is overdue in our metadata, which ties the demo narrative together — older + overdue + showing vibration drift = the picture of a real failure.

#### Area-adjusted floor_std

```ts
if (sensor === 'vibration' && area === 'production_floor') floor = 0.010;
if (sensor === 'temp' && area === 'rooftop') floor = 0.5;
```

Production floor units run near heavy machinery → their baseline vibration is genuinely higher. Rooftop units see real outdoor temperature swings. We relax the floor for those cases so we don't fire false alarms on legitimate environmental conditions.

---

### How it all fits — one timeline

Walking through HVAC_2's row 51 (the acute spike):

1. **Reading arrives**: ts = 04:10:00, temp=37, airflow=120, vibration=0.22, pressure=normal, power=normal.
2. **Cold start done**: baseline established at t=02:00 (24 readings × 5 min).
3. **Per-sensor scoring**:
   - temp peer-z ≈ 30 → sensor_score = 1.0 (clamped)
   - airflow peer-z ≈ 25 → sensor_score = 1.0
   - vibration peer-z ≈ 25 → sensor_score = 1.0
   - pressure & power: nearly normal → scores ~0.1
4. **Roll-up**: severity = 1.0, hotSignals = 3, sigmaTripHits = 3.
5. **Diversity gate**: 3 distinct sensors hot → diversity = 3 (not single-sensor).
6. **Correlation boost**: 0.30 (3+ hot).
7. **Persistence**: this is the first anomalous reading, so consecutiveAnomalous = 1.
8. **Hard override**: sigmaTripHits = 3 ≥ 2 → **TRUE**.
9. **Status decision**: hardOverride is true → **ACT immediately**.
10. **Reason codes**: `['hard_override', 'multi_signal_correlation', 'peer_deviation', 'baseline_deviation']`.
11. **Result**: confidence ≈ 1.0, status = ACT, contributing = [vibration, temp, airflow].

Runtime gets this back, pushes it to FleetStore, fires a notification, screens re-render with the unit's card now red and labeled "ACT NOW."

The next reading (row 52) at 04:15: everything's back to normal. severity drops to ~0.1. consecutiveAnomalous decays. Acute confidence drops below WATCH threshold. Status goes back to OK. But the alert remains in history.

---

### Why this passes the tests

| Test | Mechanism |
|---|---|
| HVAC_1 progresses OK → WATCH → ACT | Frozen baseline catches the slow drift; gradual track accumulates severity + peer deviation + correlation + persistence over hours |
| HVAC_2 row 51 fires ACT on single tick | Hard override on 3 sensors > 4σ peer z |
| HVAC_3 stays OK despite 33 anomalous pressure readings | Diversity gate — only one sensor ever hot → forced OK |
| HVAC_4 missing data never fires | Missing sensors excluded from scoring; ≥3 missing → UNKNOWN |

Each test exists because each mechanism was added in response to a real failure mode the dataset has. The engine isn't generic best-practice — it's specifically shaped by what these 1000 rows of data demanded.

---

## The screens

- **Fleet (home)** — list of 5 cards sorted ACT > WATCH > UNKNOWN > OK. Header summary with OK/WATCH/ACT counts and sim clock. Tap a card → detail.
- **Unit Detail** — big status hero, **Raw / Analysis toggle** (default Raw — "without our bias"), five Skia-rendered sparklines, ReasonBlock with human bullets + reason chips, UnitMetadataCard with overdue-service note, Ack / False alarm / Note actions.
- **History** — past alerts, filter chips (All / Open / False alarms), feedback buttons.
- **Settings** — notifications on/off/which severity, quiet hours, sensitivity (low/med/high), per-unit overrides, danger zone.
- **Debug** (`__DEV__` only) — pause/resume/restart replay, speed buttons (60×, 300×, 1200×, 2000×).

The **Raw / Analysis toggle on Unit Detail is the most important design choice in the whole UI**. Raw mode shows the unfiltered data with a faint peer-median reference line and no system commentary. The technician sees the data first, makes their own read, *then* taps to see what we think. That's the entire trust-rebuilding pitch in one toggle.

### The trust loop

Three "False alarm" taps for a unit within 24 hours → that unit's sensitivity drops one level (med → low → it just stays low). Seven calm days → sensitivity recovers one level. The system gets quieter for units the user thinks are over-alerting, and louder again for units that earn back trust.

---

## State management

We use Zustand because it's tiny and direct:

- **FleetStore** — current status of each unit. Lives in memory. Wiped on app restart and rebuilt from the data source. Don't persist this; the detection re-derives it.
- **AlertsStore** — every alert ever fired, plus "Acknowledged" and "False alarm" tags. Saved to MMKV. Survives restart.
- **ConfigStore** — user settings. Saved to MMKV. Survives restart.

MMKV is just "AsyncStorage but native and fast." Required prebuild step because it's not in Expo Go.

---

## Folder layout

```
src/
├── detection/engine.ts           ← THE MATH. All anomaly logic here.
├── detection/stats.ts            ← mean, std, median, mad, z-score helpers
├── detection/ringBuffer.ts       ← stores last 60 readings per unit
├── detection/reasons.ts          ← turns engine output into English bullets
├── detection/__tests__/          ← 9 tests that exercise the engine on the real CSV
│
├── datasource/types.ts           ← Reading, UnitMetadata, DataSource interface
├── datasource/CsvReplayDataSource.ts  ← reads CSV, ticks it like live data
├── datasource/LiveDataSource.ts  ← stub for the production WebSocket version
├── datasource/metadata.ts        ← loads/caches unit_metadata.json
│
├── runtime.ts                    ← the glue: DataSource → engine → stores
│
├── store/fleetStore.ts           ← live state (current status per unit) — ephemeral
├── store/alertsStore.ts          ← alert history — saved to MMKV
├── store/configStore.ts          ← user settings — saved to MMKV
├── store/mmkv.ts                 ← the storage adapter
│
├── notifications/service.ts      ← expo-notifications wrapper + quiet hours + cooldown
│
├── config/defaults.ts            ← default thresholds, weights, floor_std, sensitivity presets
│
├── screens/FleetScreen.tsx       ← home: 5 unit cards
├── screens/UnitDetailScreen.tsx  ← Raw/Analysis toggle, sparklines, reason block
├── screens/HistoryScreen.tsx     ← alert log + "False alarm" feedback
├── screens/SettingsScreen.tsx    ← notif level, quiet hours, sensitivity, overrides
├── screens/DebugScreen.tsx       ← dev-only: pause/restart/speed
│
├── components/                   ← StatusPill, UnitCard, Sparkline, ReasonBlock, TabIcons, ...
├── navigation/                   ← FleetStack, RootNavigator (bottom tabs)
├── theme/                        ← colors (dark high-contrast), spacing, typography
└── lib/                          ← csv parser wrapper, time helpers
```

---

## Build vs script narrative

**Built (this app):** bundled CSV replay, on-device engine, local Android notifications, MMKV-backed config + history.

**For the video script (not built — see the plan file):** server-side streaming engine, FCM/Expo Push from server, Android foreground service maintaining a WebSocket through shift hours, eventual ML model trained on accumulated feedback labels. The architecture is laid out so each of these is a single-component swap, not a rewrite:

| Concern | Demo (built) | Production (script narrative) |
|---|---|---|
| Data ingest | `CsvReplayDataSource` | Server streams sensors → `LiveDataSource` subscribes via WebSocket |
| Detection runtime | Engine runs on-device | Engine runs server-side. Same pure module, no rewrite. |
| Notifications | `expo-notifications` local | Server decides → Expo Push (FCM under the hood on Android) |
| Real-time during shift | DataSource ticks engine | Android foreground service maintains WebSocket to server |
| Trust loop / feedback | False-alarm taps update local config | Taps post to server → labels accumulate → ML model trained over time |

The screens, ReasonBlock, ConfidenceBar, StatusPill, and config schema are **identical** in both topologies. Promoting from demo to production is replacing two adapters (DataSource, NotificationService), not rewriting the app.

### Why the hand-tuned engine isn't a stop-gap

A trained ML model can't replace this engine on day one — it needs thousands of labeled failure events across many units to train. The hand-tuned two-track classifier is what *produces* those labels: every ack, every false-alarm tap, every note is a labeled (window, outcome) pair. After N months of fleet operation at scale, that label set is the training data for an autoencoder / isolation-forest / temporal model that slots in behind the same `evaluate(...)` interface. The order is engine → labels → model, not engine vs. model.
