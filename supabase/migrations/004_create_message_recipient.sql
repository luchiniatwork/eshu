-- Message recipients: denormalized recipient list on each message.
-- Used for reply-all resolution.

CREATE TABLE message_recipient (
    message_id      UUID NOT NULL REFERENCES message(id),
    recipient       TEXT NOT NULL,
    PRIMARY KEY (message_id, recipient)
);
