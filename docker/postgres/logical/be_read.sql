CREATE TABLE be_read (
    id TEXT PRIMARY KEY,          -- e.g. "b42"
    timestamp BIGINT NOT NULL,
    aid TEXT NOT NULL,            -- article ID
    readNum INT,
    readUidList TEXT,             -- comma-separated user IDs
    commentNum INT,
    commentUidList TEXT,
    agreeNum INT,
    agreeUidList TEXT,
    shareNum INT,
    shareUidList TEXT
);
