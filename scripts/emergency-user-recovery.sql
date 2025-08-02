-- EMERGENCY USER RECOVERY INVESTIGATION
-- This script searches for traces of missing users in all possible locations

-- ============================================
-- PART 1: CURRENT DATABASE STATE
-- ============================================

-- 1. Show remaining users (should be only 2 according to AI agent)
SELECT 
    'REMAINING USERS' as section,
    id,
    email,
    first_name,
    last_name,
    is_admin,
    has_completed_onboarding,
    created_at,
    updated_at
FROM users 
ORDER BY created_at;

-- ============================================
-- PART 2: SEARCH FOR USER TRACES
-- ============================================

-- 2. Search for orphaned email logs (these might contain deleted user IDs)
SELECT 
    'ORPHANED EMAIL LOGS' as section,
    user_id,
    email_type,
    email_subject,
    sent_at,
    COUNT(*) as count
FROM email_logs el
WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = el.user_id
)
GROUP BY user_id, email_type, email_subject, sent_at
ORDER BY sent_at DESC;

-- 3. Search for orphaned email subscriptions
SELECT 
    'ORPHANED EMAIL SUBSCRIPTIONS' as section,
    user_id,
    email_type,
    is_active,
    created_at,
    COUNT(*) as count
FROM email_subscriptions es
WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = es.user_id
)
GROUP BY user_id, email_type, is_active, created_at
ORDER BY created_at DESC;

-- 4. Search for orphaned conversations (might contain user IDs)
SELECT 
    'ORPHANED CONVERSATIONS' as section,
    user_id,
    title,
    mode,
    created_at,
    last_activity,
    COUNT(*) as count
FROM conversations c
WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = c.user_id
)
GROUP BY user_id, title, mode, created_at, last_activity
ORDER BY last_activity DESC
LIMIT 50;

-- 5. Search for orphaned team members (admin's team members might be here)
SELECT 
    'ORPHANED TEAM MEMBERS' as section,
    manager_id,
    name,
    strengths,
    created_at,
    COUNT(*) as count
FROM team_members tm
WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = tm.manager_id
)
GROUP BY manager_id, name, strengths, created_at
ORDER BY created_at DESC;

-- 6. Search for orphaned OpenAI usage logs
SELECT 
    'ORPHANED OPENAI LOGS' as section,
    user_id,
    request_type,
    created_at,
    COUNT(*) as count
FROM openai_usage_logs ol
WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = ol.user_id
)
GROUP BY user_id, request_type, created_at
ORDER BY created_at DESC
LIMIT 50;

-- 7. Search for orphaned unsubscribe tokens
SELECT 
    'ORPHANED UNSUBSCRIBE TOKENS' as section,
    user_id,
    email_type,
    created_at,
    COUNT(*) as count
FROM unsubscribe_tokens ut
WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = ut.user_id
)
GROUP BY user_id, email_type, created_at
ORDER BY created_at DESC;

-- ============================================
-- PART 3: SESSION ANALYSIS
-- ============================================

-- 8. Check active sessions (might contain user IDs that were deleted)
SELECT 
    'ACTIVE SESSIONS' as section,
    sess->>'passport'->>'user'->>'claims'->>'sub' as user_id_from_session,
    sess->>'passport'->>'user'->>'claims'->>'email' as email_from_session,
    expire,
    created_at
FROM sessions 
WHERE expire > NOW()
AND sess ? 'passport'
ORDER BY expire DESC;

-- ============================================
-- PART 4: SEARCH FOR SPECIFIC PATTERNS
-- ============================================

-- 9. Look for specific user ID patterns that might have been admin's original ID
SELECT 
    'POTENTIAL ADMIN USER IDS' as section,
    'email_logs' as source_table,
    user_id,
    COUNT(*) as references
FROM email_logs
WHERE user_id LIKE '%tinymanagerai%' 
   OR user_id LIKE '%admin%'
   OR user_id LIKE '%google-oauth2%'
GROUP BY user_id

UNION ALL

SELECT 
    'POTENTIAL ADMIN USER IDS' as section,
    'conversations' as source_table,
    user_id,
    COUNT(*) as references
FROM conversations
WHERE user_id LIKE '%tinymanagerai%' 
   OR user_id LIKE '%admin%'
   OR user_id LIKE '%google-oauth2%'
GROUP BY user_id

UNION ALL

SELECT 
    'POTENTIAL ADMIN USER IDS' as section,
    'team_members' as source_table,
    manager_id as user_id,
    COUNT(*) as references
FROM team_members
WHERE manager_id LIKE '%tinymanagerai%' 
   OR manager_id LIKE '%admin%'
   OR manager_id LIKE '%google-oauth2%'
GROUP BY manager_id;

-- ============================================
-- PART 5: DELETION TIMELINE ANALYSIS
-- ============================================

-- 10. Analyze timestamps to see when deletions might have occurred
SELECT 
    'DELETION TIMELINE ANALYSIS' as section,
    DATE_TRUNC('hour', NOW()) as current_time,
    'Recent sessions expire after this time' as note;

-- 11. Check for any pattern in remaining vs missing data
SELECT 
    'DATA CONSISTENCY CHECK' as section,
    (SELECT COUNT(*) FROM users) as remaining_users,
    (SELECT COUNT(*) FROM team_members) as remaining_team_members,
    (SELECT COUNT(*) FROM conversations) as remaining_conversations,
    (SELECT COUNT(*) FROM email_logs) as total_email_logs,
    (SELECT COUNT(*) FROM email_subscriptions) as total_email_subscriptions;

-- ============================================
-- PART 6: RECOVERY POSSIBILITY ASSESSMENT
-- ============================================

-- 12. Check if conversation_backups table has any data
SELECT 
    'CONVERSATION BACKUPS' as section,
    user_id,
    source,
    created_at,
    restored_at,
    'Potential recovery source' as note
FROM conversation_backups
ORDER BY created_at DESC
LIMIT 20;

-- 13. Final summary of recovery possibilities
SELECT 
    'RECOVERY ASSESSMENT' as section,
    CASE 
        WHEN EXISTS (SELECT 1 FROM email_logs WHERE NOT EXISTS (SELECT 1 FROM users WHERE users.id = email_logs.user_id)) THEN 'POSSIBLE: User IDs found in email logs'
        WHEN EXISTS (SELECT 1 FROM conversations WHERE NOT EXISTS (SELECT 1 FROM users WHERE users.id = conversations.user_id)) THEN 'POSSIBLE: User IDs found in conversations'
        WHEN EXISTS (SELECT 1 FROM team_members WHERE NOT EXISTS (SELECT 1 FROM users WHERE users.id = team_members.manager_id)) THEN 'POSSIBLE: Manager IDs found in team members'
        ELSE 'UNLIKELY: No traces found'
    END as recovery_status,
    NOW() as analysis_time;