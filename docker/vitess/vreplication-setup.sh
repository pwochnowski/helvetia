#!/bin/bash

# Copyright 2024 The Vitess Authors.
# VReplication Setup Script for Helvetia
# 
# This script sets up VReplication Materialize workflows to replicate:
# 1. Article (science category) from Cell1 (-80 shard) to Cell2 (80- shard)
# 2. Be-Read (science category) from Cell1 (-80 shard) to Cell2 (80- shard)

set -e

export PATH=/vt/bin:$PATH

VTCTLD_SERVER="vtctld:${GRPC_PORT:-15999}"

echo "=== Helvetia VReplication Setup ==="
echo "Waiting for tablets to be ready..."

# Wait for vtctld to be available
max_attempts=60
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if vtctldclient --server $VTCTLD_SERVER GetTablets 2>/dev/null; then
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
vtctldclient --server $VTCTLD_SERVER GetTablets

# =============================================
# Setup Materialize for Article (science) 
# Replicate from Cell1 (-80 shard) to Cell2 (80- shard)
# =============================================
echo ""
echo "=== Setting up Materialize for Article (science category) ==="

# Check if workflow already exists by looking for non-empty workflow list
workflow_exists=$(vtctldclient --server $VTCTLD_SERVER Workflow --keyspace article_keyspace show --workflow article_science_sync 2>/dev/null | grep -c '"article_science_sync"' || true)

if [ "$workflow_exists" -gt 0 ]; then
  echo "Article workflow already exists, skipping creation"
else
  echo "Creating Materialize workflow for Article science category..."
  
  # Create the Materialize workflow
  # This replicates science articles from the -80 shard (Cell1) to the 80- shard (Cell2)
  vtctldclient --server $VTCTLD_SERVER Materialize --workflow article_science_sync --target-keyspace article_keyspace create \
    --source-keyspace article_keyspace \
    --table-settings '[{"target_table": "article", "source_expression": "SELECT id, timestamp, aid, title, category, abstract, articleTags, authors, language, text, image, video FROM article WHERE category = '\''science'\''", "create_ddl": ""}]' \
    --cells "cell2" \
    --tablet-types "PRIMARY,REPLICA" || echo "⚠ Failed to create Article workflow"
  
  echo "✓ Article Materialize workflow created"
fi

# =============================================
# Setup Materialize for Be-Read (science)
# Replicate from Cell1 (-80 shard) to Cell2 (80- shard)
# =============================================
echo ""
echo "=== Setting up Materialize for Be-Read (science category) ==="

# Check if workflow already exists
workflow_exists=$(vtctldclient --server $VTCTLD_SERVER Workflow --keyspace beread_keyspace show --workflow beread_science_sync 2>/dev/null | grep -c '"beread_science_sync"' || true)

if [ "$workflow_exists" -gt 0 ]; then
  echo "Be-Read workflow already exists, skipping creation"
else
  echo "Creating Materialize workflow for Be-Read science category..."
  
  # Create the Materialize workflow
  vtctldclient --server $VTCTLD_SERVER Materialize --workflow beread_science_sync --target-keyspace beread_keyspace create \
    --source-keyspace beread_keyspace \
    --table-settings '[{"target_table": "beread", "source_expression": "SELECT id, timestamp, aid, category, readNum, readUidList, commentNum, commentUidList, agreeNum, agreeUidList, shareNum, shareUidList FROM beread WHERE category = '\''science'\''", "create_ddl": ""}]' \
    --cells "cell2" \
    --tablet-types "PRIMARY,REPLICA" || echo "⚠ Failed to create Be-Read workflow"
  
  echo "✓ Be-Read Materialize workflow created"
fi

# =============================================
# Show VReplication Status
# =============================================
echo ""
echo "=== VReplication Workflow Status ==="

echo ""
echo "Article Keyspace Workflows:"
vtctldclient --server $VTCTLD_SERVER Workflow --keyspace article_keyspace list 2>/dev/null || echo "  No workflows found"

echo ""
echo "Be-Read Keyspace Workflows:"
vtctldclient --server $VTCTLD_SERVER Workflow --keyspace beread_keyspace list 2>/dev/null || echo "  No workflows found"

# Show detailed status if workflows exist
echo ""
echo "=== Detailed Workflow Status ==="

echo ""
echo "Article Science Sync:"
vtctldclient --server $VTCTLD_SERVER Workflow --keyspace article_keyspace show --workflow article_science_sync 2>/dev/null || echo "  Workflow not found or not yet running"

echo ""
echo "Be-Read Science Sync:"
vtctldclient --server $VTCTLD_SERVER Workflow --keyspace beread_keyspace show --workflow beread_science_sync 2>/dev/null || echo "  Workflow not found or not yet running"

echo ""
echo "=== VReplication Setup Complete ==="
echo ""
echo "Workflows created:"
echo "  - article_science_sync: Replicates science articles from Cell1 to Cell2"
echo "  - beread_science_sync: Replicates science be-read stats from Cell1 to Cell2"
echo ""
echo "Useful commands:"
echo "  # Check workflow status"
echo "  vtctldclient --server $VTCTLD_SERVER Workflow --keyspace article_keyspace show --workflow article_science_sync"
echo ""
echo "  # Stop a workflow"
echo "  vtctldclient --server $VTCTLD_SERVER Workflow --keyspace article_keyspace stop --workflow article_science_sync"
echo ""
echo "  # Start a workflow"
echo "  vtctldclient --server $VTCTLD_SERVER Workflow --keyspace article_keyspace start --workflow article_science_sync"
echo ""
echo "  # Delete a workflow"
echo "  vtctldclient --server $VTCTLD_SERVER Workflow --keyspace article_keyspace delete --workflow article_science_sync"
