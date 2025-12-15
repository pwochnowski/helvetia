#/bin/bash

set -ex

cd "$(dirname "$0")"

bazel build //app:server_deploy.jar
cp $(bazel info bazel-bin)/app/server_deploy.jar  app/server_deploy.jar

docker build -t helvetia/server:latest app

rm -f app/server_deploy.jar