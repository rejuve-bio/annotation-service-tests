#!/usr/bin/env bash
# Polls system metrics every INTERVAL seconds and appends to a CSV file.
# Run this alongside Artillery: ./scripts/monitor-system.sh results/<run-dir>/system-metrics.csv
#
# Env overrides:
#   REDIS_PORT   - Redis host port (default 6399, matches docker-compose.yml host mapping)
#   REDIS_DB     - Redis DB for Celery broker (default 1)
#   INTERVAL     - Poll interval in seconds (default 5)

set -euo pipefail

OUTPUT_FILE="${1:?Usage: $0 <output-csv>}"
REDIS_PORT="${REDIS_PORT:-6399}"
REDIS_DB="${REDIS_DB:-1}"
INTERVAL="${INTERVAL:-5}"

echo "timestamp,mork_containers,annotation_mem,annotation_cpu_pct,celery_mem,redis_queue_depth" > "$OUTPUT_FILE"

_get_ctr() {
    docker ps --filter "name=${1}" --format "{{.Names}}" 2>/dev/null | head -1
}

_mem() {
    local ctr="$1"
    [ -z "$ctr" ] && echo "N/A" && return
    docker stats --no-stream --format "{{.MemUsage}}" "$ctr" 2>/dev/null | awk '{print $1}' || echo "N/A"
}

_cpu() {
    local ctr="$1"
    [ -z "$ctr" ] && echo "0" && return
    docker stats --no-stream --format "{{.CPUPerc}}" "$ctr" 2>/dev/null | tr -d '%' || echo "0"
}

echo "Monitoring started → $OUTPUT_FILE  (Ctrl-C to stop)"

while true; do
    TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    MORK_COUNT=$(docker ps --filter "ancestor=mork:latest" --format "{{.ID}}" 2>/dev/null | wc -l | tr -d ' ') || MORK_COUNT=0

    ANN_CTR=$(_get_ctr "annotation_service")
    CEL_CTR=$(_get_ctr "celery_worker")

    ANN_MEM=$(_mem "$ANN_CTR")
    ANN_CPU=$(_cpu "$ANN_CTR")
    CEL_MEM=$(_mem "$CEL_CTR")

    QUEUE_DEPTH=$(redis-cli -p "$REDIS_PORT" -n "$REDIS_DB" LLEN celery 2>/dev/null || echo "0")

    echo "$TS,$MORK_COUNT,$ANN_MEM,$ANN_CPU,$CEL_MEM,$QUEUE_DEPTH" >> "$OUTPUT_FILE"

    sleep "$INTERVAL"
done
