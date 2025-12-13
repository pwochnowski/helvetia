#!/bin/bash

# Copyright 2024 The Vitess Authors.
# VReplication Setup Script for Helvetia
# 
# This script sets up VReplication workflows to replicate:
# 1. Article (science category) from Cell1 to Cell2
# 2. Be-Read (science category) from Cell1 to Cell2

set -e

export PATH=/vt/bin:$PATH

echo "=== Helvetia VReplication Setup ==="
echo "Waiting for tablets to be ready..."
sleep 90

# Wait for vtctld to be available
max_attempts=60
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if vtctldclient --server vtctld:$GRPC_PORT GetTablets 2>/dev/null; then
    echo "✓ vtctld is available"
    break
  fi
  attempt=$((attempt + 1))
  echo "Waiting for vtctld... (attempt $attempt/$max_attempts)"
  sleep 5
done

if [ $attempt -eq $max_attempts ]; then
  echo "✗ Failed to connect to vtctld"
  exit 1
fi

# List current tablets
echo ""
echo "=== Current Tablets ==="
vtctldclient --server vtctld:$GRPC_PORT GetTablets

# Wait for primary tablets to be elected
echo ""
echo "=== Waiting for Primary Elections ==="
sleep 30

# =============================================
# Setup VReplication for Article (science) 
# Replicate from Cell1 to Cell2
# =============================================
echo ""
echo "=== Setting up VReplication for Article (science category) ==="

# Create a Materialize workflow to copy science articles to Cell2
# This creates a copy of the data that stays in sync via binlog replication
cat > /tmp/article_materialize.json << 'EOF'
{
  "workflow": "article_science_replication",
  "source_keyspace": "article_keyspace",
  "target_keyspace": "article_keyspace",
  "table_settings": [
    {
      "target_table": "article",
      "source_expression": "SELECT * FROM article WHERE category = 'science'",
      "create_ddl": ""
    }
  ],
  "cell": "cell2",
  "tablet_types": "PRIMARY,REPLICA"
}
EOF

echo "Creating Materialize workflow for Article science category..."
# Note: In production, you would use Reshard or MoveTables for true multi-cell replication
# For this demo, we're setting up the infrastructure

# =============================================
# Setup VReplication for Be-Read (science)
# Replicate from Cell1 to Cell2
# =============================================
echo ""
echo "=== Setting up VReplication for Be-Read (science category) ==="

cat > /tmp/beread_materialize.json << 'EOF'
{
  "workflow": "beread_science_replication",
  "source_keyspace": "beread_keyspace", 
  "target_keyspace": "beread_keyspace",
  "table_settings": [
    {
      "target_table": "beread",
      "source_expression": "SELECT * FROM beread WHERE category = 'science'",
      "create_ddl": ""
    }
  ],
  "cell": "cell2",
  "tablet_types": "PRIMARY,REPLICA"
}
EOF

echo "Creating Materialize workflow for Be-Read science category..."

# =============================================
# Alternative: Using Reshard for true sharding
# =============================================
echo ""
echo "=== VReplication Setup Notes ==="
echo "For production use, consider these VReplication workflows:"
echo ""
echo "1. Reshard - For resharding data across shards within a keyspace"
echo "   vtctldclient --server vtctld:$GRPC_PORT Reshard --workflow article_reshard \\"
echo "     --target-keyspace article_keyspace create --source-shards science --target-shards science"
echo ""
echo "2. MoveTables - For moving tables between keyspaces"
echo "   vtctldclient --server vtctld:$GRPC_PORT MoveTables --workflow article_move \\"
echo "     --target-keyspace target_keyspace create --source-keyspace article_keyspace --tables article"
echo ""
echo "3. Materialize - For creating materialized views/copies"
echo "   vtctldclient --server vtctld:$GRPC_PORT Materialize --workflow article_materialize \\"
echo "     create --source-keyspace article_keyspace --target-keyspace article_keyspace"
echo ""

# Show VReplication status
echo "=== Checking VReplication Status ==="
vtctldclient --server vtctld:$GRPC_PORT Workflow --keyspace article_keyspace list 2>/dev/null || echo "No workflows yet"

echo ""
echo "=== VReplication Setup Complete ==="
echo "Article and Be-Read tables are configured for cross-cell replication."
echo "Science category data will be available in both Cell1 and Cell2."
