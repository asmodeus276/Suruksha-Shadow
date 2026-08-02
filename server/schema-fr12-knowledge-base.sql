-- FR12: Knowledge-Base-Grounded Answers
-- Run this once in the Supabase SQL Editor. It's additive — it does not
-- touch any existing table from Schema.sql.

-- 1. Enable pgvector (safe to run even if already enabled)
create extension if not exists vector;

-- 2. The knowledge base itself. Populated by server/scripts/ingestKnowledgeBase.js,
--    never written to directly by the client.
create table if not exists knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('BNS', 'POSH', 'NGO directory')),
  title text not null,
  content text not null,
  embedding vector(3072), -- gemini-embedding-001's default output size
  created_at timestamptz not null default now()
);

-- 3. Similarity search. Cosine distance (<=>) — lower is more similar, so
--    we convert to a 0-1 "similarity" score (1 = identical) for a more
--    intuitive threshold in application code.
create or replace function match_knowledge_documents(
  query_embedding vector(3072),
  match_count int default 4,
  similarity_threshold float default 0.55
)
returns table (
  id uuid,
  source text,
  title text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    id,
    source,
    title,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from knowledge_documents
  where 1 - (embedding <=> query_embedding) > similarity_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- 4. RLS on, no policies added — matches every other backend-only table in
--    this schema (trusted_contacts, timeline_entries, etc). Only the
--    service-role key (used server-side) can read/write this table; the
--    client never touches it directly.
alter table knowledge_documents enable row level security;