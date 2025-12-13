#!/bin/bash

# Helvetia MySQL Client Helper
# Connects to VTGate via MySQL protocol

mysql -h 127.0.0.1 -P 15306 -u root "$@"
