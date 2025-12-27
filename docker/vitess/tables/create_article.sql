-- Article Table
-- Fragmented by category: science -> Cell1+Cell2, technology -> Cell2 only
CREATE TABLE IF NOT EXISTS `article` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `aid` VARCHAR(64) NOT NULL,
  `title` VARCHAR(512) NOT NULL,
  `category` VARCHAR(64) NOT NULL COMMENT 'Shard key: science or technology',
  `abstract` TEXT,
  `articleTags` JSON,
  `authors` JSON,
  `language` VARCHAR(32) DEFAULT 'en',
  `textPath` VARCHAR(512) COMMENT 'HDFS path for text file',
  `imagePath` VARCHAR(512) COMMENT 'HDFS path for image file',
  `videoPath` VARCHAR(512) COMMENT 'HDFS path for video file',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_aid` (`aid`),
  KEY `idx_category` (`category`),
  KEY `idx_timestamp` (`timestamp`),
  KEY `idx_title` (`title`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Lookup table for article vindex (allows queries by aid without knowing category)
CREATE TABLE IF NOT EXISTS `article_lookup` (
  `aid` VARCHAR(64) NOT NULL,
  `keyspace_id` VARBINARY(128),
  PRIMARY KEY (`aid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
