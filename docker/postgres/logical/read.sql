CREATE TABLE read (
    id TEXT PRIMARY KEY,              -- e.g. "r42"
    timestamp BIGINT NOT NULL,        -- ms timestamp
    -- FK enforcement is a logical rule, not a local SQL constraint.
    uid TEXT NOT NULL,                -- references User.uid logically
    aid TEXT NOT NULL,                -- references Article.aid logically
    readTimeLength INT,
    aggreeOrNot TEXT,                 -- generator uses "1"/"0"
    commentOrNot TEXT,                -- "1"/"0"
    shareOrNot TEXT,                  -- "1"/"0"
    commentDetail TEXT
);
