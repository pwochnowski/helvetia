docker pause vitess-vttablet_article_shard1_replica-1 

docker exec vitess-vtctld-1 vtctldclient --server localhost:15999 GetTablets | grep "article_keyspace.*-80"

# Connect to a specific tablet's MySQL
docker compose exec vttablet_article_shard1_replica mysql -u vt_dba

USE vt_article_keyspace;
SELECT * FROM article WHERE aid = 'test-id';

docker unpause vitess-vttablet_article_shard1_replica-1 

docker exec vitess-vtctld-1 vtctldclient --server localhost:15999 GetTablets | grep "article_keyspace.*-80"



