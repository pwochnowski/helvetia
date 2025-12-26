#!/bin/bash

# Backs up all shards in DC1 for cloning to DC2

set -e

VTCTLD_HOST=${VTCTLD_HOST:-vtctld}
VTCTLD_PORT=${VTCTLD_PORT:-15999}

echo "=== Creating backups of all shards ==="

# All keyspace/shard combinations
declare -a SHARDS=(
  "user_keyspace/-80"
  "user_keyspace/80-"
  "article_keyspace/-80"
  "article_keyspace/80-"
  "read_keyspace/-80"
  "read_keyspace/80-"
  "beread_keyspace/-80"
  "beread_keyspace/80-"
  "popularrank_keyspace/-80"
  "popularrank_keyspace/80-c0"
  "popularrank_keyspace/c0-"
)

for shard in "${SHARDS[@]}"; do
  keyspace="${shard%%/*}"
  shard_name="${shard#*/}"
  echo "Backing up $keyspace/$shard_name..."
  /vt/bin/vtctldclient --server "${VTCTLD_HOST}:${VTCTLD_PORT}" \
    BackupShard --allow-primary "$keyspace/$shard_name" || echo "Warning: backup failed for $keyspace/$shard_name"
done

echo "=== All backups complete ==="
