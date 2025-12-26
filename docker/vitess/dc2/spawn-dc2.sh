#!/bin/bash

# Spawns DC2 as a clone of DC1
# Usage: ./spawn-dc2.sh

set -e
cd "$(dirname "$0")"

echo "=== Helvetia DC2 Spawn Script ==="
echo ""

# Check if DC1 is running
if ! docker compose -f ../docker-compose.yml ps --status running | grep -q vtctld; then
  echo "ERROR: DC1 does not appear to be running."
  echo "Please start DC1 first with: cd .. && docker compose up -d"
  exit 1
fi

echo "=== Step 1: Create backups of DC1 ==="
docker compose -f ../docker-compose.yml exec -T vtctld /script/backup-all-shards.sh

echo ""
echo "=== Step 2: Start DC2 cluster ==="
docker compose -f docker-compose-dc2.yml up -d

echo ""
echo "=== DC2 is starting ==="
echo "Tablets will automatically restore from DC1 backups."
echo ""
echo "DC2 Endpoints:"
echo "  VTGate Cell1: localhost:25306 (MySQL protocol)"
echo "  VTGate Cell2: localhost:25307 (MySQL protocol)"
echo "  Consul UI:    http://localhost:18500"
echo "  VTCTLD:       http://localhost:25000"
echo ""
echo "VTAdmin (shared): http://localhost:14201"
echo "  - Shows both DC1 (Helvetia DC1) and DC2 (Helvetia DC2) clusters"
echo ""
echo "To check status: docker compose -f docker-compose-dc2.yml ps"
echo "To view logs:    docker compose -f docker-compose-dc2.yml logs -f"
