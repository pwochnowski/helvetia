#!/bin/bash
# Runs the two DC2 servers (second data center)

set -e
cd "$(dirname "$0")/.."

echo "=== Starting DC2 Servers ==="

# Server 1: DC2 Cell1 - VTGate port 25306
echo "Starting DC2 Server 1 (Cell1)..."
DB_URL="jdbc:mysql://127.0.0.1:25306/" PORT=8091 bazel run //app:runserver &
PID1=$!
echo "DC2 Server 1 started with PID $PID1 on port 8091 (DB: vtgate_cell1_dc2:25306)"

# Server 2: DC2 Cell2 - VTGate port 25307
echo "Starting DC2 Server 2 (Cell2)..."
DB_URL="jdbc:mysql://127.0.0.1:25307/" PORT=8092 bazel run //app:runserver &
PID2=$!
echo "DC2 Server 2 started with PID $PID2 on port 8092 (DB: vtgate_cell2_dc2:25307)"

echo ""
echo "=== DC2 Servers Running ==="
echo "  DC2 Server 1 (Cell1): http://localhost:8091  →  vtgate_cell1_dc2:25306"
echo "  DC2 Server 2 (Cell2): http://localhost:8092  →  vtgate_cell2_dc2:25307"
echo ""
echo "Press Ctrl+C to stop all servers"

wait $PID1 $PID2
