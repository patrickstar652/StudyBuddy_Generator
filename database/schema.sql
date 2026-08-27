-- Study Buddy schema for Neon Postgres.
-- Apply this file to a new Neon database before starting the Flask backend.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size >= 0),
    total_characters INTEGER NOT NULL CHECK (total_characters >= 0),
    total_tokens INTEGER NOT NULL CHECK (total_tokens >= 0),
    total_chunks INTEGER NOT NULL CHECK (total_chunks >= 0),
    status TEXT NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'ready', 'failed')),
    extracted_text TEXT NOT NULL,
    embedding_model TEXT NOT NULL,
    embedding_dimension INTEGER NOT NULL CHECK (embedding_dimension > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    token_count INTEGER NOT NULL CHECK (token_count > 0),
    start_token INTEGER NOT NULL CHECK (start_token >= 0),
    end_token INTEGER NOT NULL CHECK (end_token > start_token),
    -- Deliberately unconstrained so EMBEDDING_MODEL can use any dimension.
    embedding VECTOR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (document_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    questions JSONB NOT NULL,
    settings JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flashcards (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    deck_title TEXT NOT NULL,
    cards JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS summaries (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    document_title TEXT,
    tldr TEXT NOT NULL,
    key_points JSONB NOT NULL,
    keywords JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_embeddings_document_id_idx
    ON document_embeddings (document_id);
CREATE INDEX IF NOT EXISTS quizzes_document_id_created_at_idx
    ON quizzes (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS flashcards_document_id_created_at_idx
    ON flashcards (document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS summaries_document_id_created_at_idx
    ON summaries (document_id, created_at DESC);

-- No ANN index is created here: pgvector cannot build a single HNSW/IVFFlat
-- index over mixed vector dimensions. Study Buddy hydrates each document's
-- persisted vectors into its local FAISS cache on demand.
