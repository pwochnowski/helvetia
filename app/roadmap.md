# Phase 1 – Add a metadata/catalog layer

Introduce a small “system catalog” in the coordinator (or its own DB):

Nodes: (node_id, host, port, dc, status, capacity, role)

Fragments: (fragment_id, logical_table, partition_type, predicate/hash_range, primary_node)

Replicas: (fragment_id, node_id, replica_role [primary|secondary], sync_mode)

Everything else will read/write through this catalog.

# Phase 2 – Bulk data loading with partitioning + replicas (Req. 1)

Add a bulk-load service in the coordinator:

API: POST /load?table=User&mode=bulk with a file/stream.

Steps:

* Parse rows → call a partitioner (range / hash / list; using catalog rules).

* For each fragment: batch INSERT to its primary node.

* For each replica: apply same batches (sync or async, depending on policy).

* Keep simple at first: single partitioning scheme (e.g. hash on user_id) and replication factor R.

Later: add rebalancing/migration jobs that read from one node and bulk-insert to others using the same logic.

# Phase 3 – Efficient CRUD paths (Req. 2)

On every request, the HTTP server:

Parses the logical operation (CRUD on logical tables).

Uses the catalog to:

* map logical table → relevant fragments → nodes

* pick the right replica (e.g. primary for writes, any healthy replica for reads).

* Executes with prepared statements / connection pooling per node.

Basic optimization steps:

* Use a connection pool per node (e.g. HikariCP).

For multi-fragment reads:

push filters to nodes,

parallelize node queries,

join/union in the coordinator (naive first, optimize later).

For inserts/updates:

avoid cross-node transactions at first (one node per request),

add 2PC only when you really need multi-node atomicity.

Phase 4 – Monitoring DBMS nodes + data (Req. 3)

Add a monitoring subsystem:

Each node has a small “agent” (could just be SQL views + a lightweight polling job from the coordinator).

Metrics to collect regularly:

node status (reachable?),

data volume per fragment (row counts, table size),

CPU/load, connections, query latency (simple aggregates),

replica lag (if you add async replication).

Coordinator stores these in NodeMetrics / FragmentMetrics tables.

Add endpoints/UI:

/admin/nodes – status view

/admin/fragments – data location and sizes

/admin/workload – simple charts or stats.

Phase 5 – Advanced functions (Req. 4)
4a) Hot / Cold standby DBMSs

Represent standbys in the catalog with role=standby.

Use:

Hot standby: synchronous or near-synchronous replication from a primary node.

Cold standby: provisioned node + regular backups; promoted only on failure.

The coordinator:

monitors health,

on failure: promotes a replica to primary, updates Fragments.primary_node.

4b) Adding a new DBMS server

API: POST /admin/nodes → register (node_id, host, port, dc, capacity).

Mark it status=joining.

Run rebalance jobs:

choose fragments to move based on capacity/workload,

bulk-copy data (Phase 2 loader in “migration mode”),

update catalog once done.

Flip node status to active when it owns at least some fragments.

4c) Dropping a DBMS server

Mark node as draining.

For each fragment on this node:

if replicas exist elsewhere: promote another node as primary;

if not: migrate fragment to a new node (same migration jobs).

When no primary/replica assignments remain on that node:

set status=removed and physically shut it down.

4d) Data-center–aware migration

Extend catalog with data center (dc) and maybe rack/zone:

Nodes.dc, Fragments.preferred_dc.

Migration job can:

filter by dc (from_dc=A → to_dc=B),

maintain replication policy across DCs (one replica per DC, etc.).

For reads, add simple routing:

prefer local-DC replicas if healthy,

fall back to others.