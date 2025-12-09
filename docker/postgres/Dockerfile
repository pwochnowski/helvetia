FROM mysql:8.0

# MySQL runs .sql files in alphabetical order from this directory
#COPY logical/*.sql /docker-entrypoint-initdb.d/
COPY logical/user.sql /docker-entrypoint-initdb.d/

#COPY init.sql /docker-entrypoint-initdb.d/
