-- Maybe just generate this script inside `build_images.sh`

-- COPY logical/*.sql /docker-entrypoint-initdb.d/
-- COPY init.sql /docker-entrypoint-initdb.d/
-- \i /docker-entrypoint-initdb.d/logical/user.sql;
-- \i /docker-entrypoint-initdb.d/logical/article.sql;
-- \i /docker-entrypoint-initdb.d/logical/read.sql;
-- \i /docker-entrypoint-initdb.d/logical/be_read.sql;
-- \i /docker-entrypoint-initdb.d/logical/popular_rank.sql;
