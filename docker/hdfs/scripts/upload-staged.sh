#!/bin/bash
# Upload pre-staged articles to HDFS
# Run inside the namenode container after prepare-articles-local.sh

set -e

HDFS_ARTICLES_DIR="/articles"
STAGING_DIR="/staging"

echo "=== HDFS Upload from Staged Files ==="

# Wait for HDFS to be ready
echo "Checking HDFS..."
until hdfs dfs -ls / > /dev/null 2>&1; do
    echo "  HDFS not ready yet, waiting..."
    sleep 5
done
echo "HDFS is ready!"

# Check staging directory
if [ ! -d "$STAGING_DIR" ] || [ -z "$(ls -A $STAGING_DIR 2>/dev/null)" ]; then
    echo "ERROR: Staging directory $STAGING_DIR is empty or doesn't exist"
    echo "Run prepare-articles-local.sh on your host first"
    exit 1
fi

# Count articles
ARTICLE_COUNT=$(ls -d "$STAGING_DIR"/article* 2>/dev/null | wc -l | tr -d ' ')
echo "Found $ARTICLE_COUNT articles in staging"

# Upload to HDFS
echo ""
echo "Uploading to HDFS..."
START_TIME=$(date +%s)

hdfs dfs -mkdir -p $HDFS_ARTICLES_DIR
hdfs dfs -put -f "$STAGING_DIR"/* "$HDFS_ARTICLES_DIR/"

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo "=== Upload Complete ==="
echo "Time: ${ELAPSED}s"
echo ""
echo "Sample article:"
hdfs dfs -ls "$HDFS_ARTICLES_DIR/article0"

echo ""
echo "Total:"
hdfs dfs -count $HDFS_ARTICLES_DIR

echo ""
echo "WebHDFS URLs:"
echo "  http://localhost:9870/webhdfs/v1/articles/article0/text.txt?op=OPEN"
echo "  http://localhost:9870/webhdfs/v1/articles/article0/image.jpg?op=OPEN"
