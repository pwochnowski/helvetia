#!/bin/bash

# Helvetia vtctldclient helper
# Executes vtctldclient commands against the cluster

docker-compose exec vtctld vtctldclient --server localhost:15999 "$@"
