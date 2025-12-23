#!/bin/bash
# Prepare article files locally before uploading to HDFS
# Run this on your host machine, not inside Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOCAL_DATA_DIR="$REPO_ROOT/tools/db_gen"
STAGING_DIR="$SCRIPT_DIR/../staging"
ARTICLES_NUM=100
VIDEOS_NUM=50

echo "=== Local Article Preparation Script ==="
echo "Source: $LOCAL_DATA_DIR"
echo "Staging: $STAGING_DIR"
echo "Articles: $ARTICLES_NUM"

# Check if source directories exist
if [ ! -d "$LOCAL_DATA_DIR/bbc_news_texts" ]; then
    echo "ERROR: bbc_news_texts directory not found in $LOCAL_DATA_DIR"
    exit 1
fi

if [ ! -d "$LOCAL_DATA_DIR/image" ]; then
    echo "ERROR: image directory not found in $LOCAL_DATA_DIR"
    exit 1
fi

# Get counts
IMAGE_COUNT=$(ls "$LOCAL_DATA_DIR/image"/*.jpg 2>/dev/null | wc -l | tr -d ' ')
VIDEO_FILES=("video1.mp4" "video2.mp4")
TEXT_CATEGORIES=("business" "entertainment" "sport" "tech")

echo "Found $IMAGE_COUNT images"
echo "Found ${#VIDEO_FILES[@]} videos"

# Function to get category for an article index (deterministic)
get_text_category() {
    local idx=$1
    local hash=$(( (idx * 31 + 17) % 100 ))
    
    if [ $hash -lt 45 ]; then
        echo "tech"
    else
        local sub_hash=$(( (idx * 37 + 13) % 3 ))
        case $sub_hash in
            0) echo "business" ;;
            1) echo "entertainment" ;;
            2) echo "sport" ;;
        esac
    fi
}

# Clean and create staging directory
echo ""
echo "Preparing staging directory..."
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

# Prepare files
echo "Creating $ARTICLES_NUM article directories..."
START_TIME=$(date +%s)

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
    
    # First 50 articles get a video
    if [ $i -lt $VIDEOS_NUM ]; then
        VIDEO_IDX=$(( i % ${#VIDEO_FILES[@]} ))
        cp "$LOCAL_DATA_DIR/video/${VIDEO_FILES[$VIDEO_IDX]}" "$ARTICLE_DIR/video.mp4"
    fi
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo "=== Preparation Complete ==="
echo "Time: ${ELAPSED}s"
echo "Staging directory: $STAGING_DIR"
echo "Size: $(du -sh "$STAGING_DIR" | cut -f1)"
echo ""
echo "Now upload to HDFS with:"
echo "  docker exec hdfs-namenode bash /scripts/upload-staged.sh"
