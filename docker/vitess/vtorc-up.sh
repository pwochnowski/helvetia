#!/bin/bash

# Copyright 2024 The Vitess Authors.
# VTOrc startup script for Helvetia

set -u

export VTROOT=/vt
export VTDATAROOT=/vt/vtdataroot

web_port=${WEB_PORT:-'8080'}
external=${EXTERNAL_DB:-0}

mkdir -p $VTDATAROOT/vtorc

# Copy config
cp /script/vtorc/default.json $VTDATAROOT/vtorc/config.json

echo "Starting VTOrc..."
exec $VTROOT/bin/vtorc \
  $TOPOLOGY_FLAGS \
  --alsologtostderr \
  --port $web_port \
  --config-file $VTDATAROOT/vtorc/config.json
