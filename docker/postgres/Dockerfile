FROM postgres:16

# Put logical schemas into the image
COPY logical /docker-entrypoint-initdb.d/logical

# Put your node's init.sql into the image
COPY init.sql /docker-entrypoint-initdb.d/
