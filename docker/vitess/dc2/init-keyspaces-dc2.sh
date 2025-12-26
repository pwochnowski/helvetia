#!/bin/bash

# Initialize keyspaces and shards in DC2's topology before tablets start
# This is required so tablets can restore from DC1 backups

export PATH=/vt/bin:$PATH

VTCTLD_HOST=${VTCTLD_HOST:-vtctld_dc2}
VTCTLD_PORT=${VTCTLD_PORT:-15999}

echo "=== Initializing DC2 Topology with Keyspaces and Shards ==="
echo "Waiting for vtctld_dc2 to be ready..."

# Wait for vtctld to be available
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
  if vtctldclient --server "${VTCTLD_HOST}:${VTCTLD_PORT}" GetCellInfoNames &>/dev/null; then
    echo "vtctld_dc2 is ready"
    break
  fi
  attempt=$((attempt + 1))
  echo "Waiting for vtctld_dc2... (attempt $attempt/$max_attempts)"
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "ERROR: vtctld_dc2 did not become ready in time"
  exit 1
fi

# Define all keyspaces and their shards
declare -A KEYSPACE_SHARDS=(
  ["user_keyspace"]="-80,80-"
  ["article_keyspace"]="-80,80-"
  ["read_keyspace"]="-80,80-"
  ["beread_keyspace"]="-80,80-"
  ["popularrank_keyspace"]="-80,80-c0,c0-"
)

# Create each keyspace and its shards
for keyspace in "${!KEYSPACE_SHARDS[@]}"; do
  echo ""
  echo "Creating keyspace: $keyspace"
  
  # Create keyspace (ignore error if already exists)
  if vtctldclient --server "${VTCTLD_HOST}:${VTCTLD_PORT}" CreateKeyspace "$keyspace" 2>/dev/null; then
    echo "  ✓ Created keyspace $keyspace"
  else
    echo "  - Keyspace $keyspace already exists or error occurred"
  fi
  
  # Create shards
  IFS=',' read -ra shards <<< "${KEYSPACE_SHARDS[$keyspace]}"
  for shard in "${shards[@]}"; do
    if vtctldclient --server "${VTCTLD_HOST}:${VTCTLD_PORT}" CreateShard "$keyspace/$shard" 2>/dev/null; then
      echo "  ✓ Created shard $keyspace/$shard"
    else
      echo "  - Shard $keyspace/$shard already exists or error occurred"
    fi
  done
done

echo ""
echo "=== DC2 Topology Initialization Complete ==="
echo "Keyspaces and shards are ready for tablet restoration from backups."
