-- User Table
-- Fragmented by region: Beijing -> Cell1, HongKong -> Cell2
CREATE TABLE IF NOT EXISTS `user` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `timestamp` BIGINT,
  `uid` VARCHAR(64) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `gender` ENUM('male', 'female', 'other') DEFAULT 'other',
  `email` VARCHAR(255),
  `phone` VARCHAR(32),
  `dept` VARCHAR(128),
  `grade` VARCHAR(32),
  `language` VARCHAR(32) DEFAULT 'en',
  `region` VARCHAR(64) NOT NULL COMMENT 'Shard key: Beijing or HongKong',
  `role` VARCHAR(64) DEFAULT 'user',
  `preferTags` JSON,
  `obtainedCredits` INT DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_uid` (`uid`),
  KEY `idx_region` (`region`),
  KEY `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lookup table for user vindex (allows queries by uid without knowing region)
CREATE TABLE IF NOT EXISTS `user_lookup` (
  `uid` VARCHAR(64) NOT NULL,
  `keyspace_id` VARBINARY(128),
  PRIMARY KEY (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
