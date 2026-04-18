-- Inbox hot path: unread, non-archived messages for a recipient
CREATE INDEX idx_mailbox_inbox
    ON mailbox_entry (recipient, created_at DESC)
    WHERE read_at IS NULL AND NOT archived;

-- All mailbox entries for a recipient (for search, archive browsing)
CREATE INDEX idx_mailbox_recipient
    ON mailbox_entry (recipient, created_at DESC);

-- Thread reconstruction: all messages in a thread, ordered
CREATE INDEX idx_message_thread
    ON message (thread_id, created_at);

-- Messages by sender (for "sent" folder)
CREATE INDEX idx_message_sender
    ON message (sender, created_at DESC);

-- Full-text search on subject + body
CREATE INDEX idx_message_fts
    ON message USING gin (
        to_tsvector('english', subject || ' ' || body)
    );

-- Semantic search: HNSW for approximate nearest neighbor
CREATE INDEX idx_message_embedding
    ON message USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Directory lookups
CREATE INDEX idx_directory_project
    ON directory_entry (project_id, address);

-- Message recipients for reply-all resolution
CREATE INDEX idx_message_recipient_lookup
    ON message_recipient (message_id);

-- Receipts: find receipt-requested messages for a given message
CREATE INDEX idx_message_receipt_pending
    ON message (id)
    WHERE receipt_requested AND type = 'message';
