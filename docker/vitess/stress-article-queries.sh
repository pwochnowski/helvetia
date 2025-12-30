#!/bin/bash
# Query stress test for article_keyspace
# Sends high volume of queries to increase CPU load on tablets

set -e

# Configuration
VTGATE_HOST="${VTGATE_HOST:-127.0.0.1}"
VTGATE_PORT="${VTGATE_PORT:-15306}"
PARALLEL_WORKERS="${1:-10}"
DURATION="${2:-60}"
KEYSPACE="article_keyspace"

echo "================================================"
echo "Article Keyspace Query Stress Test"
echo "================================================"
echo "VTGate:    $VTGATE_HOST:$VTGATE_PORT"
echo "Workers:   $PARALLEL_WORKERS parallel connections"
echo "Duration:  ${DURATION}s"
echo "Keyspace:  $KEYSPACE"
echo ""
echo "Press Ctrl+C to stop."
echo "================================================"
echo ""

# Check if mysql client is available
if ! command -v mysql &> /dev/null; then
    echo "Error: mysql client not found. Install it or use Docker:"
    echo "  brew install mysql-client"
    exit 1
fi

# Test connection
echo "Testing connection..."
if ! mysql -h "$VTGATE_HOST" -P "$VTGATE_PORT" -e "SELECT 1" &> /dev/null; then
    echo "Error: Cannot connect to VTGate at $VTGATE_HOST:$VTGATE_PORT"
    exit 1
fi
echo "Connection OK!"
echo ""

# Function to run queries in a loop
run_query_worker() {
    local worker_id=$1
    local end_time=$2
    local query_count=0
    
    while [ $(date +%s) -lt $end_time ]; do
        # Mix of different query types to stress different code paths
        
        # 1. Full table scan with ORDER BY (CPU intensive)
        mysql -h "$VTGATE_HOST" -P "$VTGATE_PORT" -N -e \
            "SELECT id, aid, title, category, abstract FROM $KEYSPACE.article ORDER BY timestamp DESC LIMIT 100" \
            > /dev/null 2>&1
        ((query_count++))
        
        # 2. Aggregation query (CPU intensive)
        mysql -h "$VTGATE_HOST" -P "$VTGATE_PORT" -N -e \
            "SELECT category, COUNT(*), AVG(LENGTH(abstract)) FROM $KEYSPACE.article GROUP BY category" \
            > /dev/null 2>&1
        ((query_count++))
        
        # 3. Pattern matching (CPU intensive)
        mysql -h "$VTGATE_HOST" -P "$VTGATE_PORT" -N -e \
            "SELECT id, title FROM $KEYSPACE.article WHERE title LIKE '%a%' OR title LIKE '%e%' LIMIT 50" \
            > /dev/null 2>&1
        ((query_count++))
        
        # 4. JSON function queries (CPU intensive)
        mysql -h "$VTGATE_HOST" -P "$VTGATE_PORT" -N -e \
            "SELECT id, aid, JSON_LENGTH(articleTags), JSON_LENGTH(authors) FROM $KEYSPACE.article LIMIT 100" \
            > /dev/null 2>&1
        ((query_count++))
        
        # 5. Subquery (CPU intensive)
        mysql -h "$VTGATE_HOST" -P "$VTGATE_PORT" -N -e \
            "SELECT * FROM $KEYSPACE.article WHERE id IN (SELECT id FROM $KEYSPACE.article ORDER BY id DESC LIMIT 50)" \
            > /dev/null 2>&1
        ((query_count++))
        
        # 6. Cross-shard scatter query
        mysql -h "$VTGATE_HOST" -P "$VTGATE_PORT" -N -e \
            "SELECT COUNT(*) FROM $KEYSPACE.article WHERE category IN ('science', 'technology')" \
            > /dev/null 2>&1
        ((query_count++))
        
    done
    
    echo "Worker $worker_id: completed $query_count queries"
}

# Calculate end time
END_TIME=$(($(date +%s) + DURATION))

echo "Starting $PARALLEL_WORKERS query workers at $(date '+%H:%M:%S')..."
echo ""

# Start workers in background
pids=()
for i in $(seq 1 $PARALLEL_WORKERS); do
    run_query_worker $i $END_TIME &
    pids+=($!)
done

echo "Workers started. Waiting for completion..."
echo ""

# Show progress
while [ $(date +%s) -lt $END_TIME ]; do
    remaining=$((END_TIME - $(date +%s)))
    echo -ne "\rTime remaining: ${remaining}s   "
    sleep 1
done
echo ""
echo ""

# Wait for all workers
echo "Waiting for workers to finish..."
for pid in "${pids[@]}"; do
    wait $pid 2>/dev/null || true
done

echo ""
echo "================================================"
echo "Stress test completed at $(date '+%H:%M:%S')"
echo "================================================"
