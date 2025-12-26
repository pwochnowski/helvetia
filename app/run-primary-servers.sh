#!/bin/bash
# Runs the two primary servers (DC1 Cell1 and Cell2)

set -e
cd "$(dirname "$0")/.."

echo "=== Starting Primary Servers (DC1) ==="

# Server 1: DC1 Cell1 (Beijing) - VTGate port 15306
echo "Starting Server 1 (DC1 Cell1 - Beijing)..."
DB_URL="jdbc:mysql://127.0.0.1:15306/" PORT=8081 bazel run //app:runserver &
PID1=$!
echo "Server 1 started with PID $PID1 on port 8081 (DB: vtgate_cell1:15306)"

# Server 2: DC1 Cell2 (HongKong) - VTGate port 15307
echo "Starting Server 2 (DC1 Cell2 - HongKong)..."
DB_URL="jdbc:mysql://127.0.0.1:15307/" PORT=8082 bazel run //app:runserver &
PID2=$!
echo "Server 2 started with PID $PID2 on port 8082 (DB: vtgate_cell2:15307)"

echo ""
echo "=== Primary Servers Running ==="
echo "  Server 1 (Cell1/Beijing):  http://localhost:8081  →  vtgate_cell1:15306"
echo "  Server 2 (Cell2/HongKong): http://localhost:8082  →  vtgate_cell2:15307"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for both processes
wait $PID1 $PID2
