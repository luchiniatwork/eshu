-- Directory: contact registry for the project.
-- Each entry describes a participant and what they expect from senders.

CREATE TABLE directory_entry (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      TEXT NOT NULL,

    -- Identity
    address         TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('human', 'agent')),

    -- Communication contract
    description     TEXT,
    expectations    TEXT,

    -- Timestamps
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (project_id, address)
);
