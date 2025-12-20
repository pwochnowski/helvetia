#!/bin/bash
# Start HDFS cluster and load initial data

set -e
cd "$(dirname "$0")"

echo "=== Starting HDFS Cluster ==="
docker-compose up -d

echo ""
echo "Waiting for NameNode to be healthy..."
until curl -sf http://localhost:9870/ > /dev/null 2>&1; do
    echo "  Waiting for NameNode..."
    sleep 5
done

echo "NameNode is up!"

echo ""
echo "Waiting for DataNodes to register (30 seconds)..."
sleep 30

echo ""
echo "=== Loading Article Data into HDFS ==="
docker exec hdfs-namenode bash /scripts/load-articles.sh

echo ""
echo "=== HDFS Cluster Ready ==="
echo "NameNode Web UI: http://localhost:9870"
echo "WebHDFS API:     http://localhost:9870/webhdfs/v1/"
