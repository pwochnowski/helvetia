# HDFS Setup for Helvetia

This directory contains the Docker Compose setup for running HDFS locally.

## Architecture

- **NameNode**: Manages the filesystem namespace and regulates access to files
- **DataNode1 & DataNode2**: Store the actual data blocks (replication factor = 2)

## Quick Start

```bash
# Start HDFS cluster
docker-compose up -d

# Wait for cluster to be healthy (check Web UI at http://localhost:9870)

# Load initial article data from tools/db_gen
docker exec hdfs-namenode /scripts/load-articles.sh

# Check cluster status
docker exec hdfs-namenode hdfs dfsadmin -report
```

## Ports

| Service   | Port | Description              |
|-----------|------|--------------------------|
| NameNode  | 9870 | WebHDFS REST API / Web UI |
| NameNode  | 9000 | HDFS RPC                 |
| DataNode1 | 9864 | DataNode Web UI          |
| DataNode2 | 9865 | DataNode Web UI          |

## WebHDFS API Examples

### List files
```bash
curl "http://localhost:9870/webhdfs/v1/articles?op=LISTSTATUS"
```

### Download a file
```bash
# Follow redirects with -L
curl -L "http://localhost:9870/webhdfs/v1/articles/images/0.jpg?op=OPEN" -o image.jpg
```

### Upload a file
```bash
# Step 1: Get redirect URL
curl -i -X PUT "http://localhost:9870/webhdfs/v1/articles/images/new.jpg?op=CREATE&overwrite=true"

# Step 2: Upload to the redirected URL (or use -L for auto-follow)
curl -L -X PUT "http://localhost:9870/webhdfs/v1/articles/images/new.jpg?op=CREATE&overwrite=true" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @local-file.jpg
```

### Check file status
```bash
curl "http://localhost:9870/webhdfs/v1/articles/article0/image.jpg?op=GETFILESTATUS"
```

## HDFS Directory Structure

After loading data (10,000 articles):

```
/articles/
├── article0/
│   ├── text.txt          # BBC news text (category-based)
│   ├── image.jpg         # Random image
│   └── video.flv         # Random video
├── article1/
│   ├── text.txt
│   ├── image.jpg
│   └── video.flv
├── ...
└── article9999/
    ├── text.txt
    ├── image.jpg
    └── video.flv
```

## Integration with Helvetia App

Set the `WEBHDFS_BASE_URL` environment variable when running the Java server:

```bash
export WEBHDFS_BASE_URL=http://localhost:9870/webhdfs/v1
```

The `ArticleDaoImpl` will use this to generate download URLs for clients.

### Article Path Fields in Database

When running `bulk_insert.py`, articles are created with HDFS paths:
- `textPath`: `/articles/article{id}/text.txt`
- `imagePath`: `/articles/article{id}/image.jpg`
- `videoPath`: `/articles/article{id}/video.flv`

The server will generate download URLs like:
- `http://localhost:9870/webhdfs/v1/articles/article0/text.txt?op=OPEN`
- `http://localhost:9870/webhdfs/v1/articles/article0/image.jpg?op=OPEN`

## Local Development Setup

### /etc/hosts Configuration (Required for Mac)

When accessing WebHDFS from your local Mac, the NameNode returns a 307 redirect pointing to a DataNode hostname (e.g., `datanode1:9864`). Your Mac cannot resolve these hostnames by default.

Add these entries to your `/etc/hosts`:

```
127.0.0.1 datanode1 datanode2
```

This allows your browser and local tools to follow the redirect and download files from HDFS.

> **Note**: This is only needed for local development. When the Java app runs inside Docker on the same network, it can resolve `datanode1` and `datanode2` automatically.

## Cleanup

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (delete all data)
docker-compose down -v
```

## Troubleshooting

### Check NameNode logs
```bash
docker logs hdfs-namenode
```

### Check DataNode status
```bash
docker exec hdfs-namenode hdfs dfsadmin -report
```

### HDFS Safe Mode
If HDFS is in safe mode, wait or manually leave:
```bash
docker exec hdfs-namenode hdfs dfsadmin -safemode leave
```
