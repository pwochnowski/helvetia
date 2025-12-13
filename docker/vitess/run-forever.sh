#!/bin/bash

# Run-forever wrapper script
# Keeps the process running and restarts on failure

while true; do
  "$@"
  echo "Process exited with code $?. Restarting in 5 seconds..."
  sleep 5
done
