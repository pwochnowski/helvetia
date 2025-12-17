#!/bin/bash

# Copyright 2024 The Vitess Authors.
# Set keyspace durability policy for Helvetia

export PATH=/vt/bin:$PATH

keyspaces=${KEYSPACES:-'user_keyspace article_keyspace read_keyspace beread_keyspace popularrank_keyspace'}
grpc_port=${GRPC_PORT:-'15999'}
durability_policy=${DURABILITY_POLICY:-'none'}

echo "Waiting for vtctld to be ready..."
echo "Will set durability policy to: $durability_policy"
sleep 15

for keyspace in $keyspaces; do
  echo "Setting durability policy '$durability_policy' for $keyspace..."
  max_attempts=30
  attempt=0
  while [ $attempt -lt $max_attempts ]; do
    if vtctldclient --server vtctld:$grpc_port SetKeyspaceDurabilityPolicy --durability-policy=$durability_policy $keyspace 2>/dev/null; then
      echo "✓ Set durability policy for $keyspace"
      break
    fi
    attempt=$((attempt + 1))
    echo "Waiting for keyspace $keyspace... (attempt $attempt/$max_attempts)"
    sleep 2
  done
done

echo "Durability policy setup complete."
