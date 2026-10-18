-- Safe additive migration. Existing orders and consultation records are preserved.
CREATE TABLE IF NOT EXISTS books (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 author TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 cover_url TEXT NOT NULL DEFAULT '',
 price_zmw INTEGER, -- ngwee; NULL means price by quotation
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','preorder','published')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_books_updated ON books(updated_at);
