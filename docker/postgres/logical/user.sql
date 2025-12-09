CREATE TABLE users (
   id VARCHAR(255) PRIMARY KEY,
   ts BIGINT,
   uid VARCHAR(255),
   name VARCHAR(255)
--    gender TEXT,
--    email TEXT,
--    phone TEXT,
--    dept TEXT,
--    grade TEXT,
--    language TEXT,
--    region TEXT,
--    role TEXT,
--    prefer_tags TEXT,
--    obtained_credits TEXT
) ENGINE=InnoDB;
