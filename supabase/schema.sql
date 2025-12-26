-- Supabase SQL Schema for Study Buddy
-- 在 Supabase Dashboard 的 SQL Editor 中執行此腳本

-- Enable the pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    total_characters INTEGER,
    total_tokens INTEGER,
    total_chunks INTEGER,
    status TEXT DEFAULT 'processing',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document embeddings table (for RAG)
CREATE TABLE IF NOT EXISTS document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding vector(768), -- Dimension for text2vec-base-chinese (768維中文嵌入模型)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    questions JSONB NOT NULL,
    settings JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flashcards table
CREATE TABLE IF NOT EXISTS flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    deck_title TEXT NOT NULL,
    cards JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Summaries table
CREATE TABLE IF NOT EXISTS summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    document_title TEXT,
    tldr TEXT NOT NULL,
    key_points JSONB NOT NULL,
    keywords JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx 
ON document_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for document lookups
CREATE INDEX IF NOT EXISTS document_embeddings_document_id_idx 
ON document_embeddings(document_id);

-- Function to match documents using vector similarity
-- 使用餘弦距離 (<=> operator) 進行向量相似度搜索
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(768),
    match_count INT,
    filter_doc_id UUID
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    chunk_index INTEGER,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        de.id,
        de.content,
        de.chunk_index,
        1 - (de.embedding <=> query_embedding) AS similarity
    FROM document_embeddings de
    WHERE de.document_id = filter_doc_id
    ORDER BY de.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Row Level Security (RLS) Policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;

-- Policies for documents table
CREATE POLICY "Users can view their own documents"
ON documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents"
ON documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
ON documents FOR DELETE
USING (auth.uid() = user_id);

-- For development/testing: Allow all operations without authentication
-- Remove these policies in production!
CREATE POLICY "Allow all operations for development"
ON documents FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations for development"
ON document_embeddings FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations for development"
ON quizzes FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations for development"
ON flashcards FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations for development"
ON summaries FOR ALL
USING (true)
WITH CHECK (true);
