#!/bin/bash

# Copyright 2024 The Vitess Authors.
# VTTablet startup script for Helvetia

set -u
export VTROOT=/vt
export VTDATAROOT=/vt/vtdataroot

keyspace=${KEYSPACE:-'user_keyspace'}
shard=${SHARD:-'beijing'}
grpc_port=${GRPC_PORT:-'15999'}
web_port=${WEB_PORT:-'8080'}
vthost=${VTHOST:-`hostname -i`}
sleeptime=${SLEEPTIME:-'0'}
uid=$1
external=${EXTERNAL_DB:-0}

# If DB is not explicitly set, we default to behaviour of prefixing with vt_
[ $external = 0 ] && db_name=${DB:-"vt_$keyspace"} ||  db_name=${DB:-"$keyspace"}
db_charset=${DB_CHARSET:-''}
tablet_hostname=''

printf -v alias '%s-%010d' $CELL $uid
printf -v tablet_dir 'vt_%010d' $uid

# All tablets start as replica type - VTOrc will promote one to primary
tablet_type='replica'

# Copy config directory
cp -R /script/config $VTROOT
init_db_sql_file="$VTROOT/config/init_db.sql"

# Clear in-place edits of init_db_sql_file if any exist
sed -i '/##\[CUSTOM_SQL/{:a;N;/END\]##/!ba};//d' $init_db_sql_file 2>/dev/null || true

echo "##[CUSTOM_SQL_START]##" >> $init_db_sql_file
echo "##[CUSTOM_SQL_END]##" >> $init_db_sql_file

mkdir -p $VTDATAROOT/backups

export KEYSPACE=$keyspace
export SHARD=$shard
export TABLET_ID=$alias
export TABLET_DIR=$tablet_dir
export MYSQL_PORT=3306
export DB_PORT=${DB_PORT:-3306}
export DB_HOST=${DB_HOST:-""}
export DB_NAME=$db_name

# Delete socket files before running mysqlctld if exists.
echo "Removing $VTDATAROOT/$tablet_dir/{mysql.sock,mysql.sock.lock}..."
rm -rf $VTDATAROOT/$tablet_dir/{mysql.sock,mysql.sock.lock}

# Create mysql instances
echo "Initing mysql for tablet: $uid cell: $CELL keyspace: $keyspace shard: $shard"
$VTROOT/bin/mysqlctld \
  --init-db-sql-file=$init_db_sql_file \
  --logtostderr=true \
  --tablet-uid=$uid \
  &

sleep $sleeptime

# Create the cell
# https://vitess.io/blog/2020-04-27-life-of-a-cluster/
$VTROOT/bin/vtctldclient --server vtctld:$GRPC_PORT AddCellInfo --root vitess/$CELL --server-address consul1:8500 $CELL || true

# Set tablet args
tablet_args="--init-db-name-override $DB_NAME \
              --init-tablet-type $tablet_type \
              --enable-replication-reporter=true \
              --restore-from-backup"

echo "Starting vttablet $alias for $keyspace/$shard..."
exec $VTROOT/bin/vttablet \
  $TOPOLOGY_FLAGS \
  --logtostderr=true \
  --tablet-path $alias \
  --tablet-hostname "$vthost" \
  --health-check-interval 5s \
  --port $web_port \
  --grpc-port $grpc_port \
  --service-map 'grpc-queryservice,grpc-tabletmanager,grpc-updatestream' \
  --init-keyspace $keyspace \
  --init-shard $shard \
  --backup-storage-implementation file \
  --file-backup-storage-root $VTDATAROOT/backups \
  --queryserver-config-schema-reload-time 60s \
  $tablet_args
