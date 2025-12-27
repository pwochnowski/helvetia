#!/bin/bash
# CPU stress test script for vttablet containers
# This will push CPU usage above 80% to trigger alerts

set -e

# Default values
CONTAINER_NAME="${1:-vitess-vttablet_user_shard1_primary-1}"
DURATION="${2:-60}"  # 60 seconds (enough for 30s alert threshold + buffer)
CORES="${3:-2}"      # Number of CPU cores to stress

echo "================================================"
echo "VTTablet CPU Stress Test"
echo "================================================"
echo "Container: $CONTAINER_NAME"
echo "Duration:  ${DURATION}s ($(($DURATION / 60)) minutes)"
echo "CPU Cores: $CORES"
echo ""
echo "This will trigger the VTTabletHighCPU alert after 30 seconds."
echo "Press Ctrl+C to stop early."
echo "================================================"
echo ""

# Check if container exists
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Error: Container '$CONTAINER_NAME' not found or not running"
    echo ""
    echo "Available vttablet containers:"
    docker ps --filter name=vttablet --format "  - {{.Names}}"
    exit 1
fi

echo "Starting CPU stress at $(date '+%H:%M:%S')..."
echo ""

# Run stress command in container
# We use 'yes > /dev/null' in multiple background processes
# This is a simple CPU burner that's available in most containers
docker exec -it "$CONTAINER_NAME" bash -c "
    echo 'Spawning $CORES CPU stress workers...'
    
    # Start multiple CPU-intensive processes
    for i in \$(seq 1 $CORES); do
        (while true; do
            # Compute-intensive operation
            echo 'scale=5000; 4*a(1)' | bc -l > /dev/null 2>&1
        done) &
    done
    
    echo 'CPU stress workers started (PIDs: \$(jobs -p | tr \"\\n\" \" \"))'
    echo ''
    echo 'Monitoring CPU usage...'
    echo 'Wait ~5 minutes for the VTTabletHighCPU alert to fire in Prometheus.'
    echo ''
    
    # Monitor and show progress
    END_TIME=\$((SECONDS + $DURATION))
    while [ \$SECONDS -lt \$END_TIME ]; do
        ELAPSED=\$SECONDS
        REMAINING=\$((END_TIME - SECONDS))
        printf '\rElapsed: %02d:%02d | Remaining: %02d:%02d' \
            \$((ELAPSED/60)) \$((ELAPSED%60)) \$((REMAINING/60)) \$((REMAINING%60))
        sleep 1
    done
    
    echo ''
    echo ''
    echo 'Stress test duration completed. Stopping workers...'
    
    # Kill all background jobs
    kill \$(jobs -p) 2>/dev/null || true
    wait 2>/dev/null || true
    
    echo 'CPU stress test finished.'
" || {
    echo ""
    echo "Stress test interrupted or failed."
    echo "Cleaning up background processes in container..."
    docker exec "$CONTAINER_NAME" sh -c "killall -9 bc 2>/dev/null || true" || true
    exit 1
}

echo ""
echo "================================================"
echo "CPU stress test completed at $(date '+%H:%M:%S')"
echo ""
echo "Check Prometheus for alerts:"
echo "  http://localhost:9090/alerts"
echo ""
echo "The VTTabletHighCPU alert should be PENDING or FIRING."
echo "================================================"
