#!/bin/bash
# Load article files from db_gen into HDFS
# Creates per-article directories with randomly assigned text/image/video files
# This script runs inside the namenode container

set -e

HDFS_ARTICLES_DIR="/articles"
LOCAL_DATA_DIR="/data/db_gen"
STAGING_DIR="/tmp/hdfs_staging"
ARTICLES_NUM=10000
VIDEOS_NUM=50  # Only first 50 articles get videos
BATCH_SIZE=500  # Upload in batches for speed

echo "=== HDFS Article Data Loader ==="
echo "Creating article files for $ARTICLES_NUM articles..."

# Wait for HDFS to be fully ready
echo "Waiting for HDFS to be ready..."
until hdfs dfs -ls / > /dev/null 2>&1; do
    echo "  HDFS not ready yet, waiting..."
    sleep 5
done
echo "HDFS is ready!"

# Check if source directories exist
if [ ! -d "$LOCAL_DATA_DIR/bbc_news_texts" ]; then
    echo "ERROR: bbc_news_texts directory not found in $LOCAL_DATA_DIR"
    exit 1
fi

if [ ! -d "$LOCAL_DATA_DIR/image" ]; then
    echo "ERROR: image directory not found in $LOCAL_DATA_DIR"
    exit 1
fi

if [ ! -d "$LOCAL_DATA_DIR/video" ]; then
    echo "ERROR: video directory not found in $LOCAL_DATA_DIR"
    exit 1
fi

# Get list of available source files
TEXT_CATEGORIES=("business" "entertainment" "sport" "tech")
IMAGE_COUNT=$(ls "$LOCAL_DATA_DIR/image"/*.jpg 2>/dev/null | wc -l)
VIDEO_FILES=("video1.flv" "video2.flv")

echo "Found $IMAGE_COUNT images"
echo "Found ${#VIDEO_FILES[@]} videos"
echo "Text categories: ${TEXT_CATEGORIES[*]}"

# Function to get category for an article index (deterministic)
# Uses same logic as bulk_insert.py: science 45%, technology 55%
# We map this to text categories: science->tech, technology->business,entertainment,sport
get_text_category() {
    local idx=$1
    # Use a simple hash: (idx * 31) mod 100 to get a pseudo-random but deterministic value
    local hash=$(( (idx * 31 + 17) % 100 ))
    
    # Map to article category first (science 45%, technology 55%)
    if [ $hash -lt 45 ]; then
        # science -> use "tech" text category
        echo "tech"
    else
        # technology -> use business/entertainment/sport
        local sub_hash=$(( (idx * 37 + 13) % 3 ))
        case $sub_hash in
            0) echo "business" ;;
            1) echo "entertainment" ;;
            2) echo "sport" ;;
        esac
    fi
}

# Create staging directory structure locally first (much faster than individual HDFS puts)
echo ""
echo "Preparing files locally in staging directory..."
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

for i in $(seq 0 $((ARTICLES_NUM - 1))); do
    ARTICLE_DIR="$STAGING_DIR/article$i"
    mkdir -p "$ARTICLE_DIR"
    
    # Progress indicator
    if [ $((i % 1000)) -eq 0 ]; then
        echo "  Preparing article $i / $ARTICLES_NUM..."
    fi
    
    # Pick text file from category matching article's category (deterministic)
    TEXT_CAT=$(get_text_category $i)
    TEXT_FILES=("$LOCAL_DATA_DIR/bbc_news_texts/$TEXT_CAT"/*.txt)
    TEXT_COUNT=${#TEXT_FILES[@]}
    TEXT_IDX=$(( (i * 41 + 7) % TEXT_COUNT ))
    cp "${TEXT_FILES[$TEXT_IDX]}" "$ARTICLE_DIR/text.txt"
    
    # Pick one deterministic image per article
    IMG_IDX=$(( (i * 29 + 11) % IMAGE_COUNT ))
    cp "$LOCAL_DATA_DIR/image/$IMG_IDX.jpg" "$ARTICLE_DIR/image.jpg"
    
    # First 50 articles get a video (deterministic selection)
    if [ $i -lt $VIDEOS_NUM ]; then
        VIDEO_IDX=$(( i % ${#VIDEO_FILES[@]} ))
        cp "$LOCAL_DATA_DIR/video/${VIDEO_FILES[$VIDEO_IDX]}" "$ARTICLE_DIR/video.flv"
    fi
done

echo "  Local staging complete!"

# Upload entire staging directory to HDFS in one go
echo ""
echo "Uploading to HDFS (bulk upload)..."
hdfs dfs -mkdir -p $HDFS_ARTICLES_DIR
hdfs dfs -put -f "$STAGING_DIR"/* "$HDFS_ARTICLES_DIR/"

# Cleanup staging
rm -rf "$STAGING_DIR"

echo ""
echo "=== HDFS Content Summary ==="
echo "Sample article structure:"
hdfs dfs -ls "$HDFS_ARTICLES_DIR/article0"
hdfs dfs -ls "$HDFS_ARTICLES_DIR/article1"

echo ""
echo "Total directories and files:"
hdfs dfs -count $HDFS_ARTICLES_DIR

echo ""
echo "=== WebHDFS Access URLs ==="
echo "List articles:      http://localhost:9870/webhdfs/v1/articles?op=LISTSTATUS"
echo "Download text:      http://localhost:9870/webhdfs/v1/articles/article0/text.txt?op=OPEN"
echo "Download image:     http://localhost:9870/webhdfs/v1/articles/article0/image.jpg?op=OPEN"
echo "Download video:     http://localhost:9870/webhdfs/v1/articles/article0/video.flv?op=OPEN"
echo ""
echo "Done!"
