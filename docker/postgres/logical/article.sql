CREATE TABLE Article (
    id TEXT PRIMARY KEY,          -- e.g. "a42"
    timestamp BIGINT NOT NULL,    -- python gives a millisecond timestamp
    aid TEXT NOT NULL,            -- separate article identifier (string)
    title TEXT NOT NULL,
    category TEXT,
    abstract TEXT,
    articleTags TEXT,
    authors TEXT,
    language TEXT,
    text TEXT,                    -- filename of text file
    image TEXT,                   -- comma-separated image filenames
    video TEXT                    -- filename or empty
);