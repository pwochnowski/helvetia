-- Maybe just generate this script inside `build_images.sh`

\i /docker-entrypoint-initdb.d/logical/user.sql;
\i /docker-entrypoint-initdb.d/logical/article.sql;
\i /docker-entrypoint-initdb.d/logical/read.sql;
\i /docker-entrypoint-initdb.d/logical/be_read.sql;
\i /docker-entrypoint-initdb.d/logical/popular_rank.sql;
