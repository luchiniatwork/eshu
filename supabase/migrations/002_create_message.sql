-- Messages: core content unit.
-- Each message belongs to a thread, may reply to a parent,
-- and has a type distinguishing regular messages from read receipts.

CREATE TABLE message (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          TEXT NOT NULL,

    -- Threading
    thread_id           UUID NOT NULL,
    in_reply_to         UUID REFERENCES message(id),

    -- Content
    sender              TEXT NOT NULL,
    subject             TEXT NOT NULL,
    body                TEXT NOT NULL,

    -- Type: regular message or system-generated read receipt
    type                TEXT NOT NULL DEFAULT 'message'
                        CHECK (type IN ('message', 'receipt')),

    -- Read receipt request (only meaningful for type = 'message')
    receipt_requested   BOOLEAN NOT NULL DEFAULT false,

    -- Semantic search
    embedding           VECTOR(1536),

    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
