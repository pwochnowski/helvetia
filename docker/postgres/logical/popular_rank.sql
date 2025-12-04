CREATE TABLE popular_rank (
    id TEXT PRIMARY KEY,                 -- e.g. "pr42"
    timestamp BIGINT NOT NULL,
    temporalGranularity TEXT CHECK (
        temporalGranularity IN ('daily', 'weekly', 'monthly')
    ),
    articleAidList TEXT                  -- comma-separated list of article AIDs
);