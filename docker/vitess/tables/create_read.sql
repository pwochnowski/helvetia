-- Read Table
-- Fragmented based on User table (follows user's region), no replica
-- Same allocation as User: Beijing users -> Cell1, HongKong users -> Cell2
CREATE TABLE IF NOT EXISTS `read` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `uid` VARCHAR(64) NOT NULL COMMENT 'References user.uid',
  `aid` VARCHAR(64) NOT NULL COMMENT 'References article.aid',
  `region` VARCHAR(64) NOT NULL COMMENT 'Shard key: Beijing or HongKong (must match user region)',
  `readTimeLength` INT DEFAULT 0 COMMENT 'Reading time in seconds',
  `agreeOrNot` TINYINT(1) DEFAULT 0,
  `commentOrNot` TINYINT(1) DEFAULT 0,
  `commentDetail` TEXT,
  `shareOrNot` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_uid` (`uid`),
  KEY `idx_aid` (`aid`),
  KEY `idx_region` (`region`),
  KEY `idx_timestamp` (`timestamp`),
  UNIQUE KEY `idx_uid_aid` (`uid`, `aid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lookup table for read vindex (allows queries by id without knowing region)
CREATE TABLE IF NOT EXISTS `read_lookup` (
  `id` BIGINT NOT NULL,
  `keyspace_id` VARBINARY(128),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
