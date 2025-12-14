-- Chat Sessions Schema
-- Run this in Supabase SQL Editor

-- Drop existing objects if they exist (for clean re-run)
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP FUNCTION IF EXISTS update_chat_session_timestamp() CASCADE;
DROP FUNCTION IF EXISTS generate_session_title() CASCADE;

-- Table: chat_sessions
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_clerk_id ON chat_sessions(clerk_id);
CREATE INDEX idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);

-- Table: chat_messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    sources JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- Function: Auto-update updated_at on chat_sessions
CREATE OR REPLACE FUNCTION update_chat_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_sessions
    SET updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_chat_session
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_chat_session_timestamp();

-- Function: Auto-generate title from first message
CREATE OR REPLACE FUNCTION generate_session_title()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM chat_messages WHERE session_id = NEW.session_id) = 1
       AND NEW.role = 'user' THEN
        UPDATE chat_sessions
        SET title = LEFT(NEW.content, 50) || CASE
            WHEN LENGTH(NEW.content) > 50 THEN '...'
            ELSE ''
        END
        WHERE id = NEW.session_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_generate_title
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION generate_session_title();

COMMENT ON TABLE chat_sessions IS 'Stores chat conversation sessions';
COMMENT ON TABLE chat_messages IS 'Stores individual messages within chat sessions';

-- Enable Row Level Security
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_sessions
CREATE POLICY "Backend can view sessions"
    ON chat_sessions
    FOR SELECT
    USING (true);

CREATE POLICY "Backend can insert sessions"
    ON chat_sessions
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Backend can update sessions"
    ON chat_sessions
    FOR UPDATE
    USING (true);

CREATE POLICY "Backend can delete sessions"
    ON chat_sessions
    FOR DELETE
    USING (true);

-- RLS Policies for chat_messages
CREATE POLICY "Backend can view messages"
    ON chat_messages
    FOR SELECT
    USING (true);

CREATE POLICY "Backend can insert messages"
    ON chat_messages
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Backend can update messages"
    ON chat_messages
    FOR UPDATE
    USING (true);

CREATE POLICY "Backend can delete messages"
    ON chat_messages
    FOR DELETE
    USING (true);
