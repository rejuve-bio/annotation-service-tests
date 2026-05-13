#!/usr/bin/env bash
# Runs an Artillery load test tier alongside system monitoring and saves all results.
#
# Usage:
#   ./scripts/run-test.sh <tier> <backend> <label>
#
# Arguments:
#   tier     - light | moderate | heavy
#   backend  - mork_cli | neo4j  (used for naming only)
#   label    - baseline | optionA | optionB  (used for naming only)
#
# Examples:
#   ./scripts/run-test.sh light mork_cli baseline
#   ./scripts/run-test.sh heavy mork_cli optionA
#   ./scripts/run-test.sh moderate neo4j baseline
#
# Env vars (auto-sourced from $REPO_DIR/.env when present):
#   TARGET_URL, AUTH_TOKEN, SPECIES
#   REDIS_PORT, REDIS_DB, INTERVAL (passed to monitor-system.sh)

set -euo pipefail

TIER="${1:?Usage: $0 <tier> <backend> <label>}"
BACKEND="${2:?Usage: $0 <tier> <backend> <label>}"
LABEL="${3:?Usage: $0 <tier> <backend> <label>}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=/dev/null
[ -f "$REPO_DIR/.env" ] && source "$REPO_DIR/.env"

LOAD_DIR="$REPO_DIR/load-tests"
RESULTS_BASE="$LOAD_DIR/results"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RUN_NAME="${BACKEND}-${LABEL}-${TIER}-${TIMESTAMP}"
RUN_DIR="$RESULTS_BASE/$RUN_NAME"

TEST_FILE="$LOAD_DIR/test-${TIER}.yml"
if [ ! -f "$TEST_FILE" ]; then
    echo "ERROR: test file not found: $TEST_FILE"
    echo "Available tiers: light, moderate, heavy"
    exit 1
fi

mkdir -p "$RUN_DIR"

ARTILLERY_JSON="$RUN_DIR/artillery.json"
METRICS_CSV="$RUN_DIR/system-metrics.csv"
NOTES_FILE="$RUN_DIR/notes.md"

cat > "$NOTES_FILE" <<EOF
# Run: $RUN_NAME

- **Backend**: $BACKEND
- **Optimization**: $LABEL
- **Tier**: $TIER
- **Date**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
- **Target**: ${TARGET_URL:-"(set TARGET_URL)"}
- **Species**: ${SPECIES:-all}

## Observations

(fill in after run)

## Container count (peak)

(check system-metrics.csv)
EOF

echo "──────────────────────────────────────────"
echo "Run:     $RUN_NAME"
echo "Tier:    $TIER  ($TEST_FILE)"
echo "Results: $RUN_DIR"
echo "──────────────────────────────────────────"

# Start system monitor in background
"$SCRIPT_DIR/monitor-system.sh" "$METRICS_CSV" &
MONITOR_PID=$!
echo "Monitor PID: $MONITOR_PID"

cleanup() {
    echo ""
    echo "Stopping monitor (PID $MONITOR_PID)..."
    kill "$MONITOR_PID" 2>/dev/null || true
    wait "$MONITOR_PID" 2>/dev/null || true

    if [ -f "$ARTILLERY_JSON" ]; then
        echo "Generating HTML report..."
        node "$LOAD_DIR/generate-report.js" "$ARTILLERY_JSON" || true
        echo "Report: ${ARTILLERY_JSON%.json}.html"
    fi

    echo ""
    echo "Results saved to: $RUN_DIR"
    echo "  artillery.json        — Artillery raw metrics"
    echo "  $(basename "${ARTILLERY_JSON%.json}").html  — HTML report"
    echo "  system-metrics.csv    — Container/memory/CPU/queue over time"
    echo "  notes.md              — Fill in observations"
}
trap cleanup EXIT

echo "Starting Artillery..."
cd "$LOAD_DIR"
npx artillery run \
    --output "$ARTILLERY_JSON" \
    "$TEST_FILE"
