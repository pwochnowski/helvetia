#!/bin/bash

# Copyright 2024 The Vitess Authors.
# VTTablet startup script for Helvetia DC2 - with restore from backup

set -u
export VTROOT=/vt
export VTDATAROOT=/vt/vtdataroot

keyspace=${KEYSPACE:-'user_keyspace'}
shard=${SHARD:-'beijing'}
grpc_port=${GRPC_PORT:-'15999'}
web_port=${WEB_PORT:-'8080'}
vthost=${VTHOST:-`hostname -i`}
sleeptime=${SLEEPTIME:-'0'}
uid=${TABLET_UID:?'TABLET_UID is required'}
external=${EXTERNAL_DB:-0}
restore_from_backup=${RESTORE_FROM_BACKUP:-1}

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

# For DC2 restore from backup: Don't use --init-db-sql-file as it creates 
# an empty database that prevents restore. Just start mysqlctld without init.
if [ "$restore_from_backup" = "1" ]; then
  echo "Starting mysqlctld WITHOUT init (will restore from backup) for tablet: $uid"
  $VTROOT/bin/mysqlctld \
    --logtostderr=true \
    --tablet-uid=$uid \
    &
else
  echo "Initing mysql for tablet: $uid cell: $CELL keyspace: $keyspace shard: $shard"
  $VTROOT/bin/mysqlctld \
    --init-db-sql-file=$init_db_sql_file \
    --logtostderr=true \
    --tablet-uid=$uid \
    &
fi

sleep $sleeptime

# Create the cell - NOTE: DC2 uses consul1_dc2
$VTROOT/bin/vtctldclient --server vtctld_dc2:$GRPC_PORT AddCellInfo --root vitess/$CELL --server-address consul1_dc2:8500 $CELL || true

# Set tablet args - DC2 always restores from backup
tablet_args="--init-db-name-override $DB_NAME \
              --init-tablet-type $tablet_type \
              --enable-replication-reporter=true"

if [ "$restore_from_backup" = "1" ]; then
  tablet_args="$tablet_args --restore-from-backup"
  echo "DC2 tablet will restore from backup"
fi

echo "Starting vttablet $alias for $keyspace/$shard (DC2)..."
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
