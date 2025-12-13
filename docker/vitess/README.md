# Helvetia: Two-Cell Vitess Distributed Database Setup

This setup demonstrates a distributed database architecture using Vitess with two cells (DBMS1/DBMS2), implementing region-based sharding using the `region_json` vindex type.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Vitess Cluster                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Consul (Topology Service)  │  VTCtld (Control Plane)  │  VTGate (Router)  │
├─────────────────────────────┴───────────────────────────┴───────────────────┤
│                                                                              │
│  ┌────────────────────────────┐    ┌────────────────────────────────────┐   │
│  │   Shard -80 (Cell1/DBMS1)  │    │    Shard 80- (Cell2/DBMS2)         │   │
│  │      Beijing Region        │    │       HongKong Region              │   │
│  ├────────────────────────────┤    ├────────────────────────────────────┤   │
│  │ User (region=Beijing)      │    │ User (region=HongKong)             │   │
│  │ Article (category=science) │    │ Article (category=technology)      │   │
│  │ Read (region=Beijing)      │    │ Read (region=HongKong)             │   │
│  │ Be-Read (category=science) │    │ Be-Read (category=technology)      │   │
│  │ Popular-Rank (daily)       │    │ Popular-Rank (weekly/monthly)      │   │
│  └────────────────────────────┘    └────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Sharding Strategy: `region_json` Vindex

The `region_json` vindex type enables geographic/category-based sharding:

1. **Two columns** define routing: `(id, region_column)`
2. The `region_column` value is looked up in a JSON map to get a **region byte prefix**
3. The `id` is hashed to fill the remaining keyspace_id bytes
4. Data routes to shards based on the keyspace_id range

### Region Maps (in `config/`)

| File | Mapping | Shard Routing |
|------|---------|---------------|
| `region_map.json` | `{"Beijing": 64, "HongKong": 192}` | Beijing→`-80`, HongKong→`80-` |
| `category_map.json` | `{"science": 64, "technology": 192}` | science→`-80`, technology→`80-` |
| `temporal_map.json` | `{"daily": 64, "weekly": 192, "monthly": 224}` | daily→`-80`, weekly/monthly→`80-` |

### Lookup Tables

Each table has a corresponding `*_lookup` table that stores `(key, keyspace_id)` mappings, enabling efficient queries by primary key without knowing the region.

## Table Fragmentation Schema

| Table | Vindex Columns | Shard `-80` (Cell1) | Shard `80-` (Cell2) |
|-------|----------------|---------------------|---------------------|
| **User** | `(id, region)` | Beijing | HongKong |
| **Article** | `(id, category)` | science | technology |
| **Read** | `(id, region)` | Beijing users | HongKong users |
| **Be-Read** | `(id, category)` | science articles | technology articles |
| **Popular-Rank** | `(id, temporalGranularity)` | daily | weekly, monthly |

## Tables Schema

### User
```sql
CREATE TABLE user (
  id BIGINT NOT NULL AUTO_INCREMENT,      -- Used in region_json vindex
  uid VARCHAR(64) NOT NULL,               -- Unique user identifier
  name VARCHAR(128) NOT NULL,
  region VARCHAR(64) NOT NULL,            -- Shard key: 'Beijing' or 'HongKong'
  email VARCHAR(255),
  ...
);

CREATE TABLE user_lookup (                -- Lookup vindex table
  uid VARCHAR(64) NOT NULL PRIMARY KEY,
  keyspace_id VARBINARY(128)
);
```

### Article
```sql
CREATE TABLE article (
  id BIGINT NOT NULL AUTO_INCREMENT,      -- Used in region_json vindex
  aid VARCHAR(64) NOT NULL,               -- Unique article identifier
  title VARCHAR(512) NOT NULL,
  category VARCHAR(64) NOT NULL,          -- Shard key: 'science' or 'technology'
  ...
);

CREATE TABLE article_lookup (             -- Lookup vindex table
  aid VARCHAR(64) NOT NULL PRIMARY KEY,
  keyspace_id VARBINARY(128)
);
```

### Read
```sql
CREATE TABLE read (
  id BIGINT NOT NULL AUTO_INCREMENT,      -- Used in region_json vindex
  uid VARCHAR(64) NOT NULL,               -- References user.uid
  aid VARCHAR(64) NOT NULL,               -- References article.aid
  region VARCHAR(64) NOT NULL,            -- Shard key: 'Beijing' or 'HongKong'
  ...
);
```

### Be-Read
```sql
CREATE TABLE beread (
  id BIGINT NOT NULL AUTO_INCREMENT,      -- Used in region_json vindex
  aid VARCHAR(64) NOT NULL,               -- References article.aid
  category VARCHAR(64) NOT NULL,          -- Shard key: 'science' or 'technology'
  readNum INT, readUidList JSON,
  ...
);
```

### Popular-Rank
```sql
CREATE TABLE popular_rank (
  id BIGINT NOT NULL AUTO_INCREMENT,      -- Used in region_json vindex
  temporalGranularity VARCHAR(32) NOT NULL, -- Shard key: 'daily', 'weekly', 'monthly'
  articleAidList JSON NOT NULL,
  rankDate DATE NOT NULL,
  ...
);
```

## Quick Start

### 1. Start the Cluster

```bash
cd docker/vitess
docker-compose up -d
```

### 2. Check Cluster Status

```bash
# View all tablets
docker-compose exec vtctld vtctldclient --server localhost:15999 GetTablets

# Check vschema for a keyspace
docker-compose exec vtctld vtctldclient --server localhost:15999 GetVSchema user_keyspace
```

### 3. Connect via MySQL Protocol

```bash
docker-compose exec vtgate mysql -h 127.0.0.1 -P 15306 -u root
```

Or from host (if port is exposed):
```bash
mysql -h 127.0.0.1 -P 15306 -u root
```

### 4. Sample Queries

```sql
-- Insert a Beijing user (automatically routes to shard -80)
INSERT INTO user_keyspace.user (id, uid, name, region, email) 
VALUES (1, 'u001', 'Zhang Wei', 'Beijing', 'zhang@example.com');

-- Insert a HongKong user (automatically routes to shard 80-)
INSERT INTO user_keyspace.user (id, uid, name, region, email) 
VALUES (2, 'u002', 'Chan Tai Man', 'HongKong', 'chan@example.com');

-- Insert a science article (routes to shard -80)
INSERT INTO article_keyspace.article (id, aid, title, category, abstract) 
VALUES (1, 'a001', 'Quantum Computing Advances', 'science', 'Latest research...');

-- Insert a technology article (routes to shard 80-)
INSERT INTO article_keyspace.article (id, aid, title, category, abstract) 
VALUES (2, 'a002', 'AI in Healthcare', 'technology', 'Applications of AI...');

-- Query all users (scatter query across all shards)
SELECT * FROM user_keyspace.user;

-- Query by region (routes to specific shard)
SELECT * FROM user_keyspace.user WHERE region = 'Beijing';

-- Check which shard has which data
USE user_keyspace:-80;
SELECT id, uid, name, region FROM user;

USE user_keyspace:80-;
SELECT id, uid, name, region FROM user;

-- View lookup table (shows keyspace_id routing)
SELECT uid, HEX(keyspace_id) FROM user_keyspace.user_lookup;
```

## Web UIs

| Service | URL | Description |
|---------|-----|-------------|
| Consul | http://localhost:8500 | Topology service UI |
| VTCtld | http://localhost:15000 | Cluster management |
| VTGate | http://localhost:15099 | Query router status |
| VTOrc | http://localhost:13000 | Orchestrator UI |

## Keyspaces and Shards

| Keyspace | Shards | Vindex Type | Routing Column |
|----------|--------|-------------|----------------|
| `user_keyspace` | `-80`, `80-` | `region_json` | `region` |
| `article_keyspace` | `-80`, `80-` | `region_json` | `category` |
| `read_keyspace` | `-80`, `80-` | `region_json` | `region` |
| `beread_keyspace` | `-80`, `80-` | `region_json` | `category` |
| `popularrank_keyspace` | `-80`, `80-c0`, `c0-` | `region_json` | `temporalGranularity` |

## How region_json Vindex Works

1. **INSERT**: Vitess reads `(id, region)` columns
2. **Lookup**: The `region` value (e.g., "Beijing") is looked up in `region_map.json` → returns byte value (64)
3. **Hash**: The `id` is hashed to produce remaining keyspace_id bytes
4. **Combine**: Region byte (0x40) + hashed id bytes = full keyspace_id
5. **Route**: keyspace_id 0x40... falls in range `-80` (0x00-0x7F), so routes to that shard
6. **Lookup Table**: `(uid, keyspace_id)` is stored in `user_lookup` for future lookups by uid

### Example keyspace_id breakdown:
```
User with region='Beijing':
  - Beijing → 64 (0x40) from region_map.json
  - id=1 → hash produces remaining bytes
  - keyspace_id = 0x40166B40B44ABA4BD6
  - 0x40 < 0x80, so routes to shard -80
  
User with region='HongKong':
  - HongKong → 192 (0xC0) from region_map.json
  - id=2 → hash produces remaining bytes  
  - keyspace_id = 0xC006E7EA22CE92708F
  - 0xC0 >= 0x80, so routes to shard 80-
```

## Configuration Files

### VSchema Files (`vschema/`)
Define vindexes and table routing for each keyspace:
- `user_vschema.json` - User table with region-based sharding
- `article_vschema.json` - Article table with category-based sharding
- `read_vschema.json` - Read table following user regions
- `beread_vschema.json` - Be-Read table following article categories
- `popularrank_vschema.json` - Popular-Rank with temporal sharding

### Region Map Files (`config/`)
JSON files mapping string values to region byte prefixes:
- `region_map.json` - Maps Beijing/HongKong to byte values
- `category_map.json` - Maps science/technology to byte values
- `temporal_map.json` - Maps daily/weekly/monthly to byte values

### Table Definitions (`tables/`)
SQL schema files for each table including lookup tables.

## Troubleshooting

### Check tablet health
```bash
docker-compose exec vtctld vtctldclient --server localhost:15999 GetTablets
```

### View vtgate logs (check vindex loading)
```bash
docker-compose logs vtgate | grep -i region
```

### View tablet logs
```bash
docker-compose logs vttablet-cell1-user-80
```

### Check vschema
```bash
docker-compose exec vtctld vtctldclient --server localhost:15999 GetVSchema user_keyspace
```

### Apply updated vschema
```bash
docker-compose exec vtctld vtctldclient --server localhost:15999 ApplyVSchema \
  --vschema-file /script/vschema/user_vschema.json user_keyspace
```

### Query specific shard directly
```sql
USE user_keyspace:-80;
SELECT * FROM user;
```

## Cleanup

```bash
docker-compose down -v
```
