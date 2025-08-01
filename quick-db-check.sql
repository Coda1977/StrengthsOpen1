-- Quick Database Health Check Queries for TinyStrengthManager
-- Execute these queries when database connection is available

-- 1. User Overview
SELECT id, email, first_name, last_name, is_admin, has_completed_onboarding, created_at 
FROM users 
ORDER BY created_at DESC;

-- 2. User Statistics Summary
SELECT 
    COUNT(*) as total_users, 
    COUNT(CASE WHEN is_admin = true THEN 1 END) as admin_users,
    COUNT(CASE WHEN has_completed_onboarding = true THEN 1 END) as onboarded_users,
    COUNT(CASE WHEN has_completed_onboarding = false OR has_completed_onboarding IS NULL THEN 1 END) as incomplete_onboarding
FROM users;

-- 3. Users with Team Member Counts
SELECT u.email, u.first_name, u.last_name, COUNT(tm.id) as team_members_count 
FROM users u 
LEFT JOIN team_members tm ON u.id = tm.manager_id 
GROUP BY u.id, u.email, u.first_name, u.last_name 
ORDER BY team_members_count DESC;

-- 4. Data Integrity Check - Orphaned Team Members
SELECT COUNT(*) as orphaned_team_members 
FROM team_members tm 
LEFT JOIN users u ON tm.manager_id = u.id 
WHERE u.id IS NULL;

-- 5. Data Integrity Check - Orphaned Conversations
SELECT COUNT(*) as orphaned_conversations 
FROM conversations c 
LEFT JOIN users u ON c.user_id = u.id 
WHERE u.id IS NULL;

-- 6. Data Integrity Check - Orphaned Email Logs
SELECT COUNT(*) as orphaned_email_logs 
FROM email_logs el 
LEFT JOIN users u ON el.user_id = u.id 
WHERE u.id IS NULL;

-- 7. System Activity Overview
SELECT 
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT tm.id) as total_team_members,
    COUNT(DISTINCT c.id) as total_conversations,
    COUNT(DISTINCT m.id) as total_messages,
    COUNT(DISTINCT el.id) as total_email_logs
FROM users u
FULL OUTER JOIN team_members tm ON u.id = tm.manager_id
FULL OUTER JOIN conversations c ON u.id = c.user_id
FULL OUTER JOIN messages m ON c.id = m.conversation_id
FULL OUTER JOIN email_logs el ON u.id = el.user_id;

-- 8. Duplicate Email Detection
SELECT email, COUNT(*) as duplicate_count 
FROM users 
WHERE email IS NOT NULL 
GROUP BY email 
HAVING COUNT(*) > 1;

-- 9. Conversation Mode Analysis
SELECT 
    mode,
    COUNT(*) as conversation_count,
    COUNT(CASE WHEN is_archived = true THEN 1 END) as archived_count
FROM conversations 
GROUP BY mode;

-- 10. Email Subscription Health
SELECT 
    email_type,
    COUNT(*) as total_subscriptions,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_subscriptions,
    AVG(CAST(weekly_email_count AS INTEGER)) as avg_emails_sent
FROM email_subscriptions 
GROUP BY email_type;

-- 11. Recent User Growth (Last 30 Days)
SELECT 
    DATE(created_at) as registration_date,
    COUNT(*) as new_users
FROM users 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY registration_date DESC;

-- 12. Most Active Users (by conversation count)
SELECT 
    u.email,
    u.first_name,
    u.last_name,
    COUNT(c.id) as conversation_count,
    MAX(c.last_activity) as last_conversation_activity
FROM users u
LEFT JOIN conversations c ON u.id = c.user_id
GROUP BY u.id, u.email, u.first_name, u.last_name
HAVING COUNT(c.id) > 0
ORDER BY conversation_count DESC
LIMIT 10;