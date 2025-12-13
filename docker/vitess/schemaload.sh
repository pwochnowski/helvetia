#!/bin/bash -e

# Copyright 2024 The Vitess Authors.
# Schema loading script for Helvetia

sleeptime=${SLEEPTIME:-0}
targettab=${TARGETTAB:-"${CELL}-0000000101"}
schema_files=${SCHEMA_FILES:-'create_user.sql'}
vschema_file=${VSCHEMA_FILE:-'vschema/user_vschema.json'}
load_file=${POST_LOAD_FILE:-''}
external_db=${EXTERNAL_DB:-'0'}
export PATH=/vt/bin:$PATH

sleep $sleeptime

if [ ! -f schema_run ]; then
  while true; do
    vtctldclient --server vtctld:$GRPC_PORT GetTablet $targettab && break
    sleep 1
  done
  
  # Wait for a primary tablet to be elected for each shard before applying schema
  if [ "$external_db" = "0" ]; then
    echo "Waiting for primary tablets to be elected..."
    max_attempts=60
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
      # Check if any PRIMARY tablet exists for this keyspace
      primary_count=$(vtctldclient --server vtctld:$GRPC_PORT GetTablets --keyspace=$KEYSPACE 2>/dev/null | grep -c "primary" || echo "0")
      if [ "$primary_count" != "0" ]; then
        echo "✓ Found primary tablet(s) for $KEYSPACE"
        break
      fi
      attempt=$((attempt + 1))
      echo "Waiting for primary tablet election... (attempt $attempt/$max_attempts)"
      sleep 2
    done
    
    for schema_file in $schema_files; do
      echo "Applying Schema ${schema_file} to ${KEYSPACE}"
      # Retry schema application up to 30 times
      schema_attempt=0
      schema_max=30
      while [ $schema_attempt -lt $schema_max ]; do
        if vtctldclient --server vtctld:$GRPC_PORT ApplySchema --sql-file /script/tables/${schema_file} $KEYSPACE 2>/dev/null || \
           vtctldclient --server vtctld:$GRPC_PORT ApplySchema --sql "$(cat /script/tables/${schema_file})" $KEYSPACE 2>/dev/null; then
          echo "✓ Successfully applied schema ${schema_file}"
          break
        fi
        schema_attempt=$((schema_attempt + 1))
        echo "Schema application attempt $schema_attempt failed, retrying..."
        sleep 3
      done
    done
  fi
  
  echo "Applying VSchema ${vschema_file} to ${KEYSPACE}"
  vschema_attempt=0
  vschema_max=30
  while [ $vschema_attempt -lt $vschema_max ]; do
    if vtctldclient --server vtctld:$GRPC_PORT ApplyVSchema --vschema-file /script/${vschema_file} $KEYSPACE 2>/dev/null; then
      echo "✓ Successfully applied VSchema"
      break
    fi
    vschema_attempt=$((vschema_attempt + 1))
    echo "VSchema application attempt $vschema_attempt failed, retrying..."
    sleep 3
  done
  
  touch schema_run
  
  echo "Schema and VSchema applied successfully for ${KEYSPACE}"
fi
