#!/bin/bash -e

# Copyright 2024 The Vitess Authors.
# Schema loading script for all Helvetia keyspaces

sleeptime=${SLEEPTIME:-60}
export PATH=/vt/bin:$PATH

echo "Waiting ${sleeptime}s for tablets to initialize..."
sleep $sleeptime

# Define keyspaces and their configurations
# Format: keyspace:target_tablet:schema_files:vschema_file
KEYSPACE_CONFIGS=(
  "user_keyspace:cell1-0000000101:create_user.sql:vschema/user_vschema.json"
  "article_keyspace:cell1-0000000201:create_article.sql:vschema/article_vschema.json"
  "read_keyspace:cell1-0000000301:create_read.sql:vschema/read_vschema.json"
  "beread_keyspace:cell1-0000000401:create_beread.sql:vschema/beread_vschema.json"
  "popularrank_keyspace:cell1-0000000501:create_popularrank.sql:vschema/popularrank_vschema.json"
)

load_schema_for_keyspace() {
  local keyspace=$1
  local targettab=$2
  local schema_files=$3
  local vschema_file=$4

  echo ""
  echo "=========================================="
  echo "Loading schema for ${keyspace}"
  echo "=========================================="

  # Wait for target tablet to be available
  echo "Waiting for tablet ${targettab}..."
  max_attempts=60
  attempt=0
  while [ $attempt -lt $max_attempts ]; do
    if vtctldclient --server vtctld:${GRPC_PORT} GetTablet $targettab 2>/dev/null; then
      echo "✓ Tablet ${targettab} is available"
      break
    fi
    attempt=$((attempt + 1))
    sleep 2
  done

  if [ $attempt -eq $max_attempts ]; then
    echo "✗ Timeout waiting for tablet ${targettab}"
    return 1
  fi

  # Wait for a primary tablet to be elected
  echo "Waiting for primary tablet election for ${keyspace}..."
  attempt=0
  while [ $attempt -lt $max_attempts ]; do
    primary_count=$(vtctldclient --server vtctld:${GRPC_PORT} GetTablets --keyspace=$keyspace 2>/dev/null | grep -c "primary" || echo "0")
    if [ "$primary_count" != "0" ]; then
      echo "✓ Found primary tablet(s) for ${keyspace}"
      break
    fi
    attempt=$((attempt + 1))
    echo "  Waiting for primary... (attempt $attempt/$max_attempts)"
    sleep 2
  done

  if [ $attempt -eq $max_attempts ]; then
    echo "✗ Timeout waiting for primary tablet for ${keyspace}"
    return 1
  fi

  # Apply schema files
  for schema_file in $schema_files; do
    echo "Applying schema ${schema_file} to ${keyspace}..."
    schema_attempt=0
    schema_max=30
    while [ $schema_attempt -lt $schema_max ]; do
      if vtctldclient --server vtctld:${GRPC_PORT} ApplySchema --sql-file /script/tables/${schema_file} $keyspace 2>/dev/null || \
         vtctldclient --server vtctld:${GRPC_PORT} ApplySchema --sql "$(cat /script/tables/${schema_file})" $keyspace 2>/dev/null; then
        echo "✓ Successfully applied schema ${schema_file}"
        break
      fi
      schema_attempt=$((schema_attempt + 1))
      echo "  Schema attempt $schema_attempt failed, retrying..."
      sleep 3
    done

    if [ $schema_attempt -eq $schema_max ]; then
      echo "✗ Failed to apply schema ${schema_file} after ${schema_max} attempts"
      return 1
    fi
  done

  # Apply VSchema
  echo "Applying VSchema ${vschema_file} to ${keyspace}..."
  vschema_attempt=0
  vschema_max=30
  while [ $vschema_attempt -lt $vschema_max ]; do
    if vtctldclient --server vtctld:${GRPC_PORT} ApplyVSchema --vschema-file /script/${vschema_file} $keyspace 2>/dev/null; then
      echo "✓ Successfully applied VSchema for ${keyspace}"
      break
    fi
    vschema_attempt=$((vschema_attempt + 1))
    echo "  VSchema attempt $vschema_attempt failed, retrying..."
    sleep 3
  done

  if [ $vschema_attempt -eq $vschema_max ]; then
    echo "✗ Failed to apply VSchema for ${keyspace} after ${vschema_max} attempts"
    return 1
  fi

  echo "✓ Schema loading complete for ${keyspace}"
}

# Check if already run
if [ -f /tmp/schemaload_all_done ]; then
  echo "Schema already loaded (marker file exists). Exiting."
  exit 0
fi

# Load schemas for all keyspaces
for config in "${KEYSPACE_CONFIGS[@]}"; do
  IFS=':' read -r keyspace targettab schema_files vschema_file <<< "$config"
  if ! load_schema_for_keyspace "$keyspace" "$targettab" "$schema_files" "$vschema_file"; then
    echo "✗ Failed to load schema for ${keyspace}"
    exit 1
  fi
done

# Mark as complete
touch /tmp/schemaload_all_done

echo ""
echo "=========================================="
echo "✓ All schemas loaded successfully!"
echo "=========================================="
