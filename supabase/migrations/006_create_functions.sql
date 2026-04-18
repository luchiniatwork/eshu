-- Semantic search within a recipient's mailbox

CREATE OR REPLACE FUNCTION search_messages(
    p_project_id    TEXT,
    p_recipient     TEXT,
    p_embedding     VECTOR(1536),
    p_limit         INT DEFAULT 20,
    p_threshold     FLOAT DEFAULT 0.25,
    p_folder        TEXT DEFAULT 'inbox',
    p_include_archived BOOLEAN DEFAULT false
)
RETURNS TABLE (
    id              UUID,
    thread_id       UUID,
    sender          TEXT,
    subject         TEXT,
    body            TEXT,
    type            TEXT,
    similarity      FLOAT,
    created_at      TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id,
        m.thread_id,
        m.sender,
        m.subject,
        m.body,
        m.type,
        (1 - (m.embedding <=> p_embedding))::FLOAT AS similarity,
        m.created_at
    FROM message m
    WHERE m.project_id = p_project_id
      AND m.embedding IS NOT NULL
      AND (1 - (m.embedding <=> p_embedding)) > p_threshold
      AND (
          -- Inbox: messages in recipient's mailbox
          (p_folder = 'inbox' AND EXISTS (
              SELECT 1 FROM mailbox_entry me
              WHERE me.message_id = m.id
                AND me.recipient = p_recipient
                AND (p_include_archived OR NOT me.archived)
          ))
          OR
          -- Sent: messages sent by this address
          (p_folder = 'sent' AND m.sender = p_recipient)
          OR
          -- All: inbox + sent
          (p_folder = 'all' AND (
              m.sender = p_recipient
              OR EXISTS (
                  SELECT 1 FROM mailbox_entry me
                  WHERE me.message_id = m.id
                    AND me.recipient = p_recipient
                    AND (p_include_archived OR NOT me.archived)
              )
          ))
      )
    ORDER BY m.embedding <=> p_embedding
    LIMIT p_limit;
END;
$$;
