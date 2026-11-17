# 08 — Firefox reliability

## What happened

A full local run of the 300-execution matrix (30 tests × 10 projects, 4 workers) passed 297. The three failures were all `en-firefox` timeouts at the 60 s limit: P-01 and I-02 (account creation) and N-01 (a UI-only test, timing out while the browser context was being closed). No assertion failed. Every `en-firefox` test was slow for about three minutes of that run (median 23 s, against 8 to 16 s for the other projects). Reruns in isolation shortly afterwards timed out in 3 of 9 attempts.

The completed GitHub Actions runs after the CI fixes (2 workers per job on Ubuntu) all passed, with Firefox jobs taking 90 to 190 s.

## Question

Is the cause resource contention, QA response time, or a test synchronization problem?

## Method and evidence

Machine: 8 logical CPUs (4 cores, Intel i7-1165G7), 31.8 GB RAM, Windows. All measurements below were taken the same day. No account was created except where stated.

**1. Browser cost, one browser at a time** (6 visits to the signup page, median):

| Engine | Launch | Load | DOM ready | Teardown |
|---|---:|---:|---:|---:|
| Chromium | 0.3–0.6 s | 1.6–1.8 s | 0.8 s | 0.07 s |
| Firefox | 0.9–1.6 s | 2.1–2.2 s | 1.4–1.7 s | 0.9–1.0 s |
| WebKit | 0.1 s | 0.7–0.8 s | 0.7–0.8 s | 0.04 s |

**2. QA response time, same visits.** Server response (time to first byte) was 200–250 ms and the geolocation API 115–130 ms on all three engines. With four browsers at once these rose only modestly (TTFB 420–490 ms, geolocation 165–200 ms on Firefox), while Firefox's own launch, load and teardown grew 2–3× (launch 2.1 s, load 4.9–6.3 s, teardown 2.0–2.4 s, with p90 values up to 9.5 s). Chromium and WebKit barely moved.

**3. Worker count, UI tests only** (24 tests, `en-firefox`, current code):

| Workers | Wall time | Median test | Slowest test | CPU average / max | Lowest free memory |
|---:|---:|---:|---:|---:|---:|
| 1 | 63 s | 2.4 s | 3.9 s | 37% / 97% | 11.4 GB |
| 2 | 45 s | 3.0 s | 6.6 s | 64% / 89% | 11.0 GB |
| 4 | 53 s | 6.6 s | 14.7 s | 93% / 100% | 10.1 GB |
| 4 (Chromium, reference) | 27 s | 3.9 s | 4.6 s | 90% / 100% | 11.3 GB |

Four workers saturate the CPU and are slower in wall time than two. Memory is not a constraint.

**4. The three failing tests, 4 repeats each, current code:**

| Workers | Passed | Timeouts | Median | Slowest |
|---:|---:|---:|---:|---:|
| 4 | 12 / 12 | 0 | 19.7 s | 24.3 s |
| 2 | 12 / 12 | 0 | 12.8 s | 15.7 s |
| 1 | 12 / 12 | 0 | 6.9 s | 13.2 s |

Duration grows almost 3× from one worker to four.

**5. Old code against current code** (commit `6ac6b5a` against the working tree; `en-firefox` UI tests, 4 workers, three alternating pairs, 72 executions each): median 9.3 s against 8.8 s, p90 13.2 s against 14.1 s, slowest 21.1 s against 18.6 s, no failures in either. The code change made no measurable difference.

## Findings

- **Resource contention is the cause.** Firefox is the heaviest engine here (3× Chromium's startup, 13–20× its teardown), duration scales with the number of concurrent Firefox instances, and CPU saturates at four workers. N-01 timed out in teardown, which is where Firefox costs most.
- **QA response time is not implicated.** Server and API latency were stable and the same for all engines.
- **A synchronization problem in the tests is not indicated.** The old and new code behave the same, and single-worker runs are fast and clean.

## Correction

Local `workers` is now 2 (it was 4 locally and 2 in CI), with the evidence recorded next to it in `playwright.config.ts`. Two workers had the best wall time for Firefox and keeps the slowest measured test far below the limit. The 60 s timeout was **not** raised, because that would only hide contention.

## Remaining uncertainty

- The three original timeouts did not reproduce in about 250 later Firefox executions, so what made the machine slower during that window (background load, antivirus scanning, other applications) was not identified. The conclusion is that four Firefox workers leave no headroom on this machine, not that this specific trigger was found.
- Results are for one laptop. A machine with more cores may tolerate more workers; use `--workers`.
- GitHub Actions per-test timings were not available (raw reports are no longer uploaded), so the local-versus-CI comparison rests on job durations only.
- The measured optimum comes from UI tests. The full matrix at two workers, on the final code: 300/300 executions passed, 0 failed, 0 flaky, 0 retried, in 7.0 min 52.0 s (2 workers, CPU average 63%, slowest execution 17.4 s against the 60 s limit; Firefox median 3.0 s, p90 5.9 s). One run is not proof of stability; the earlier four-worker runs passed 600/600 on a quiet machine and 297/300 on a busy one, which is the variation this change is meant to absorb.
