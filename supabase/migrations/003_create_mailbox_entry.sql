-- Mailbox entries: per-recipient state for each message.
-- Tracks read/unread and archived status.

CREATE TABLE mailbox_entry (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES message(id),
    recipient       TEXT NOT NULL,
    read_at         TIMESTAMPTZ,
    archived        BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One entry per recipient per message
    UNIQUE (message_id, recipient)
);
