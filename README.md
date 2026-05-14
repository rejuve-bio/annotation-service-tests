# Annotation Service: Load Testing Guide

This repository contains the infrastructure configuration and load-testing suite for the Annotation Service. It uses **Docker Compose** for orchestration and **Artillery** with the **Socket.io engine** to simulate high-concurrency hybrid traffic.

## 🚀 Getting Started

### 1. Prerequisites
* **Docker & Docker Compose**
* **Node.js** (v20.18.1+) and **npm** — required by Artillery's `undici` dependency. Use [nvm](https://github.com/nvm-sh/nvm) to manage versions: `nvm install 20 && nvm use 20`
* A `.env` file in the root directory — copy `.env.example` and fill in your values.

### 2. Infrastructure Setup
The service requires MongoDB, Redis, and a Celery worker to function.

1.  **Configure the Service:**
    Ensure `config/config.yaml` is set to the **mork** database type to enable the specific logic required for this test version:
    ```yaml
    database:
      type: mork
    ```

2.  **Spin up the Stack:**
    ```bash
    docker-compose up -d
    ```
    This starts the `annotation_service`, `celery_worker`, `mongodb`, `redis`, and a `caddy` reverse proxy. Note that `ulimits` are set to **65536** to handle high-concurrency socket connections.

---

## 🧪 Running Load Tests

The suite simulates a **Hybrid POST + WebSocket** flow:
1. **POST** to `/query`: Generates an annotation and captures the `annotation_id`.
2. **Socket.io Join**: Connects to a room using the captured ID.
3. **Wait**: Listens for completion events via the `processor.js` logic.

### 1. Install Dependencies
Navigate to the `load-tests` directory:
```bash
cd load-tests
npm install
```

### 2. Configure via Environment Variables
The test target and auth token are passed as environment variables — no secrets are stored in tracked files.

| Variable | Description |
| :--- | :--- |
| `TARGET_URL` | Base URL of the annotation service (e.g. `http://<host>:<port>`) |
| `AUTH_TOKEN` | Bearer token for the service API |
| `SPECIES` | Query pool to use: `all` (default), `human`, or `fly` |
| `COMPLETION_TIMEOUT_MS` | Socket.IO wait timeout in ms (default: `2400000` = 40 min) |

Copy the example file and fill in your values:
```bash
cp ../.env.example ../.env
# edit .env with your TARGET_URL, AUTH_TOKEN, and SPECIES
```

`run-test.sh` auto-sources `.env` from the repo root, so no manual `source` step is needed.

### 3. Execute the Test

Use `scripts/run-test.sh` to run a tier. It creates a timestamped results directory, starts the system monitor in the background, runs Artillery, and generates an HTML report on exit.

```
./scripts/run-test.sh <tier> <backend> <label>
```

| Argument | Values | Purpose |
| :--- | :--- | :--- |
| `tier` | `light` \| `moderate` \| `heavy` \| `complex` | Selects the load profile |
| `backend` | `mork_cli` \| `neo4j` | Used in the results directory name only |
| `label` | `baseline` \| `optionA` \| … | Used in the results directory name only |

```bash
# Baseline light run against mork_cli
./scripts/run-test.sh light mork_cli baseline

# Heavy stress run to compare an optimisation
./scripts/run-test.sh heavy mork_cli optionA

# Moderate run against neo4j
./scripts/run-test.sh moderate neo4j baseline

# Degenerate query isolation (Q4b + CARD9 only, single user)
./scripts/run-test.sh complex mork_cli optionA
```

Results are saved to `load-tests/results/<backend>-<label>-<tier>-<timestamp>/` (gitignored) and include:

| File | Contents |
| :--- | :--- |
| `artillery.json` | Raw Artillery metrics |
| `artillery.html` | HTML report (generated on exit) |
| `system-metrics.csv` | Container count, memory, CPU, and Redis queue depth over time |
| `notes.md` | Pre-filled run metadata — add observations after the run |

---

## 📊 Load Test Tiers

| Tier | Duration | Arrival Rate | Max VUs | Use case |
| :--- | :--- | :--- | :--- | :--- |
| **light** | 120s | 1/s (constant) | 5 | Baseline / smoke test |
| **moderate** | 120s | 3/s (constant) | 20 | Typical sustained load |
| **heavy** | 10s warm-up + 60s ramp | 10 ➔ 25/s | — | Stress / peak capacity |
| **complex** | 60s | 1/s | 1 | Degenerate query isolation (Q4b + CARD9 only) |

Artillery outputs per-query latency histograms labeled `latency_<query name>`, making it easy to compare complexity costs across query types and species.

---

## 🗂 Key Files

| File | Purpose |
| :--- | :--- |
| `scripts/run-test.sh` | Orchestrator — runs a tier, monitors system resources, saves results |
| `scripts/monitor-system.sh` | Polls Docker stats and Redis queue depth into CSV every 5s |
| `load-tests/test-light.yml` | Light tier: 1/s, max 5 VUs, 120s |
| `load-tests/test-moderate.yml` | Moderate tier: 3/s, max 20 VUs, 120s |
| `load-tests/test-heavy.yml` | Heavy tier: 10→25/s ramp |
| `load-tests/processor.js` | Cycles through the active species query pool; excludes degenerate queries (Q4b, CARD9) reserved for the complex tier |
| `load-tests/processor-complex.js` | Processor for `test-complex.yml` — cycles Q4b and CARD9 only |
| `load-tests/test-complex.yml` | Complex isolation tier: single user, 60s, uses `processor-complex.js` |
| `load-tests/queries/human.js` | 7 human BioAtomSpace query definitions (Q1–Q6 + CARD9 disease chain) |
| `load-tests/queries/fly.js` | 6 Drosophila (FlyBase) query definitions |
| `load-tests/utils.js` | Shared helpers (e.g. `generateNodeId`) |
| `config/config.yaml` | **Must** have `type: mork` for this test suite |

---

## ➕ Adding a New Species

1. Create `load-tests/queries/<species>.js` and export an array of query generator lambdas. Each lambda must return `{ name, payload }`. See `queries/fly.js` for the pattern.
2. In `load-tests/processor.js`, import the new file and register it in both `SPECIES_MAP` and the `all` spread:
   ```js
   const mouseQueries = require('./queries/mouse');
   const SPECIES_MAP = { human: humanQueriesFiltered, fly: flyQueries, mouse: mouseQueries };
   // then in the ALL_QUERIES 'all' branch:
   ? [...humanQueriesFiltered, ...flyQueries, ...mouseQueries]
   ```

That's it — `SPECIES=mouse` will work and `SPECIES=all` will include the new queries in the cycle.

> **Note:** Queries that are degenerate (extremely long-running) should be added to `EXCLUDED_HUMAN_INDICES` (or the equivalent set for their species) rather than the standard rotation. Add them to `processor-complex.js` instead so they run only in the `complex` tier.

---

## 🛠 Troubleshooting

* **Connection Refused:** Verify `TARGET_URL` is correct and the service is running.
* **Database Mismatch:** If the service fails to start, double-check that `config/config.yaml` is correctly mounted via the volumes defined in `docker-compose.yml`.
* **Worker Lag:** If WebSockets don't receive events, check the `celery_worker` logs to ensure tasks aren't pooling.
* **FAILED query status:** The predicate name used in the query may not match what the service expects. Update the relevant query in `queries/<species>.js` and re-run.
