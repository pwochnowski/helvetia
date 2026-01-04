#!/bin/bash
# Runs the backup server (DC1 Cell3 - uses Cell3 VTGate with backup profile)

set -e
cd "$(dirname "$0")/.."

echo "=== Starting Backup Server (DC1 Cell3) ==="

# Backup server uses Cell1 VTGate (same data, backup replicas)
echo "Starting Backup Server (DC1 Cell3)..."
DB_URL="jdbc:mysql://127.0.0.1:15308/" PORT=8083 bazel run //app:runserver &
PID=$!
echo "Backup Server started with PID $PID on port 8083 (DB: vtgate_cell3:15308)"

echo ""
echo "=== Backup Server Running ==="
echo "  Backup Server (Cell3): http://localhost:8083  →  vtgate_cell3:15308"
echo ""
echo "Press Ctrl+C to stop"

wait $PID
