-- Popular-Rank Table
-- Fragmented by temporalGranularity:
-- daily -> Cell1, weekly/monthly -> Cell2
CREATE TABLE IF NOT EXISTS `popular_rank` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `temporalGranularity` VARCHAR(32) NOT NULL COMMENT 'Shard key: daily, weekly, or monthly',
  `articleAidList` JSON NOT NULL COMMENT 'Ordered list of article AIDs by popularity',
  `rankDate` DATE NOT NULL COMMENT 'The date/week/month this ranking represents',
  PRIMARY KEY (`id`),
  KEY `idx_granularity` (`temporalGranularity`),
  KEY `idx_timestamp` (`timestamp`),
  UNIQUE KEY `idx_granularity_date` (`temporalGranularity`, `rankDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lookup table for popularrank vindex (allows queries by id without knowing temporalGranularity)
CREATE TABLE IF NOT EXISTS `popularrank_lookup` (
  `id` BIGINT NOT NULL,
  `keyspace_id` VARBINARY(128),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
