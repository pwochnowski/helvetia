CREATE DATABASE IF NOT EXISTS user_keyspace;

GRANT ALL PRIVILEGES ON user_keyspace.* TO 'helvetia'@'%';
FLUSH PRIVILEGES;

USE user_keyspace;

CREATE TABLE users (
   id BIGINT PRIMARY KEY,
   timestamp BIGINT NULL,
   uid VARCHAR(255),
   name VARCHAR(255),
   gender VARCHAR(50),
   email VARCHAR(255),
   phone VARCHAR(50),
   dept VARCHAR(255),
   grade VARCHAR(50),
   language VARCHAR(50),
   region VARCHAR(50),
   role VARCHAR(50),
   preferTags TEXT,
   obtainedCredits INT DEFAULT 0
) ENGINE=InnoDB;
