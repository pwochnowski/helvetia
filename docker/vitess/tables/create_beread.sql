-- Be-Read Table (Article Statistics)
-- Fragmented based on Article table with duplication:
-- science -> Cell1+Cell2 (replicated), technology -> Cell2 only
CREATE TABLE IF NOT EXISTS `beread` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `aid` VARCHAR(64) NOT NULL COMMENT 'References article.aid',
  `category` VARCHAR(64) NOT NULL COMMENT 'Shard key: science or technology',
  `readNum` INT DEFAULT 0,
  `readUidList` JSON COMMENT 'List of user UIDs who read this article',
  `commentNum` INT DEFAULT 0,
  `commentUidList` JSON COMMENT 'List of user UIDs who commented',
  `agreeNum` INT DEFAULT 0,
  `agreeUidList` JSON COMMENT 'List of user UIDs who agreed/liked',
  `shareNum` INT DEFAULT 0,
  `shareUidList` JSON COMMENT 'List of user UIDs who shared',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_aid` (`aid`),
  KEY `idx_category` (`category`),
  KEY `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lookup table for beread vindex (allows queries by id without knowing category)
CREATE TABLE IF NOT EXISTS `beread_lookup` (
  `id` BIGINT NOT NULL,
  `keyspace_id` VARBINARY(128),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
