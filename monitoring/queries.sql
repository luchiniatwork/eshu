-- Eshu — Monitoring Queries
-- =========================================================================
-- Five operational queries from SPEC section 10. Run against the Eshu
-- PostgreSQL database to assess system health.
--
-- Usage:
--   psql "$ESHU_DATABASE_URL" -f monitoring/queries.sql
--
-- Each query filters by project_id. Set the psql variable before running:
--   psql "$ESHU_DATABASE_URL" -v project_id="'my-project'" -f monitoring/queries.sql
--
-- Or replace :project_id with a literal string in each query.
-- =========================================================================


-- -------------------------------------------------------------------------
-- 1. Message volume — daily sent/received counts per participant (last 7d)
--
-- High volume from a single agent may indicate a messaging loop.
-- Zero volume from a registered address may indicate a misconfigured skill.
-- -------------------------------------------------------------------------

SELECT
    participant,
    SUM(sent) AS sent,
    SUM(received) AS received,
    SUM(sent + received) AS total
FROM (
    -- Sent
    SELECT
        m.sender AS participant,
        COUNT(*) AS sent,
        0 AS received
    FROM message m
    WHERE m.project_id = :project_id
      AND m.type = 'message'
      AND m.created_at >= now() - interval '7 days'
    GROUP BY m.sender

    UNION ALL

    -- Received
    SELECT
        me.recipient AS participant,
        0 AS sent,
        COUNT(*) AS received
    FROM mailbox_entry me
    JOIN message m ON m.id = me.message_id
    WHERE m.project_id = :project_id
      AND m.type = 'message'
      AND me.created_at >= now() - interval '7 days'
    GROUP BY me.recipient
) AS activity
GROUP BY participant
ORDER BY total DESC;


-- -------------------------------------------------------------------------
-- 2. Unread backlog — messages sitting unread for more than 24 hours
--
-- A growing backlog for an agent address likely indicates the agent isn't
-- checking its inbox (skill misconfiguration or agent offline).
-- -------------------------------------------------------------------------

SELECT
    me.recipient,
    COUNT(*) AS unread_count,
    MIN(me.created_at) AS oldest_unread
FROM mailbox_entry me
JOIN message m ON m.id = me.message_id
WHERE m.project_id = :project_id
  AND me.read_at IS NULL
  AND NOT me.archived
  AND me.created_at < now() - interval '24 hours'
GROUP BY me.recipient
ORDER BY unread_count DESC;


-- -------------------------------------------------------------------------
-- 3. Thread depth — threads with more than 20 messages
--
-- Very long threads may indicate agents looping or failing to resolve an
-- issue. Review these threads for circular conversations.
-- -------------------------------------------------------------------------

SELECT
    m.thread_id,
    COUNT(*) AS message_count,
    MIN(m.created_at) AS started_at,
    MAX(m.created_at) AS last_message_at,
    (SELECT m2.subject FROM message m2
     WHERE m2.id = m.thread_id) AS subject
FROM message m
WHERE m.project_id = :project_id
  AND m.type = 'message'
GROUP BY m.thread_id
HAVING COUNT(*) > 20
ORDER BY message_count DESC;


-- -------------------------------------------------------------------------
-- 4. Receipt fulfillment — receipt-requested messages where not all
--    recipients have generated a read receipt after 24 hours
--
-- Unfulfilled receipts may indicate recipients are ignoring or not
-- receiving messages.
-- -------------------------------------------------------------------------

SELECT
    m.id AS message_id,
    m.sender,
    m.subject,
    m.created_at AS sent_at,
    ARRAY_AGG(me.recipient) FILTER (WHERE me.read_at IS NULL) AS unread_by,
    COUNT(*) FILTER (WHERE me.read_at IS NULL) AS unread_count,
    COUNT(*) AS total_recipients
FROM message m
JOIN mailbox_entry me ON me.message_id = m.id
WHERE m.project_id = :project_id
  AND m.receipt_requested = true
  AND m.type = 'message'
  AND m.created_at < now() - interval '24 hours'
GROUP BY m.id, m.sender, m.subject, m.created_at
HAVING COUNT(*) FILTER (WHERE me.read_at IS NULL) > 0
ORDER BY m.created_at;


-- -------------------------------------------------------------------------
-- 5. Directory coverage — addresses appearing in messages but not
--    registered in the directory
--
-- The API validates recipients at send time, so orphaned addresses
-- typically indicate directory entries that were removed after messages
-- were sent. This is a data hygiene check, not a real-time alert.
-- -------------------------------------------------------------------------

SELECT DISTINCT active_address, source
FROM (
    SELECT sender AS active_address, 'sender' AS source
    FROM message
    WHERE project_id = :project_id

    UNION

    SELECT mr.recipient AS active_address, 'recipient' AS source
    FROM message_recipient mr
    JOIN message m ON m.id = mr.message_id
    WHERE m.project_id = :project_id
) AS addresses
WHERE active_address NOT IN (
    SELECT address FROM directory_entry
    WHERE project_id = :project_id
)
ORDER BY active_address;
