#/bin/bash

set -ex

cd "$(dirname "$0")"
docker build -t helvetia/postgres:dev postgres
