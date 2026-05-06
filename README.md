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
The test target and auth token are passed as environment variables — no secrets are stored in files.

| Variable | Description |
| :--- | :--- |
| `TARGET_URL` | Base URL of the annotation service (e.g. `http://<host>:<port>`) |
| `AUTH_TOKEN` | Bearer token for the service API |
| `SPECIES` | Query pool to use: `all` (default), `human`, or `fly` |

### 3. Execute the Test

Results are saved to `results/` (gitignored) as a timestamped JSON file. After the run, use the provided `generate-report.js` script to convert the latest JSON result into an HTML report.

```bash
# Create the results directory once
mkdir -p results

# Run all species (default)
TARGET_URL=http://<host>:<port> AUTH_TOKEN=<your_token> \
  npx artillery run test.yml --output results/report-$(date +%Y%m%d-%H%M%S).json

# Run only fly queries
TARGET_URL=http://<host>:<port> AUTH_TOKEN=<your_token> SPECIES=fly \
  npx artillery run test.yml --output results/report-$(date +%Y%m%d-%H%M%S).json

# Run only human queries
TARGET_URL=http://<host>:<port> AUTH_TOKEN=<your_token> SPECIES=human \
  npx artillery run test.yml --output results/report-$(date +%Y%m%d-%H%M%S).json

# Generate an HTML report from the latest JSON result
node generate-report.js results/$(ls -t results/ | head -1)
```

---

## 📊 Test Phases

| Phase | Duration | Arrival Rate | Description |
| :--- | :--- | :--- | :--- |
| **Warm up** | 10s | 10 users/s | Initial baseline traffic. |
| **Ramp up** | 60s | 10 ➔ 25 users/s | Increasing load to test Mork version stability. |

Artillery outputs per-query latency histograms labeled `latency_<query name>`, making it easy to compare complexity costs across query types and species.

---

## 🗂 Key Files

| File | Purpose |
| :--- | :--- |
| `test.yml` | Artillery test definition — Socket.io engine, flow, phases |
| `processor.js` | Thin orchestrator — cycles through the active species query pool in order |
| `queries/human.js` | 6 human BioAtomSpace query definitions |
| `queries/fly.js` | 6 Drosophila (FlyBase) query definitions |
| `utils.js` | Shared helpers (e.g. `generateNodeId`) |
| `config.yaml` | **Must** have `type: mork` for this test suite |

---

## ➕ Adding a New Species

1. Create `load-tests/queries/<species>.js` and export an array of query generator lambdas. Each lambda must return `{ name, payload }`. See `queries/fly.js` for the pattern.
2. In `load-tests/processor.js`, import the new file and register it in both `SPECIES_MAP` and the `all` spread:
   ```js
   const mouseQueries = require('./queries/mouse');
   const SPECIES_MAP = { human: humanQueries, fly: flyQueries, mouse: mouseQueries };
   // then in the ALL_QUERIES 'all' branch:
   ? [...humanQueries, ...flyQueries, ...mouseQueries]
   ```

That's it — `SPECIES=mouse` will work and `SPECIES=all` will include the new queries in the cycle.

---

## 🛠 Troubleshooting

* **Connection Refused:** Verify `TARGET_URL` is correct and the service is running.
* **Database Mismatch:** If the service fails to start, double-check that `config/config.yaml` is correctly mounted via the volumes defined in `docker-compose.yml`.
* **Worker Lag:** If WebSockets don't receive events, check the `celery_worker` logs to ensure tasks aren't pooling.
* **FAILED query status:** The predicate name used in the query may not match what the service expects. Update the relevant query in `queries/<species>.js` and re-run.
