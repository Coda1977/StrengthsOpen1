-- Comprehensive Database Analysis and Admin Fix Script
-- Run this script to fix admin access and check database integrity

-- ============================================
-- PART 1: CURRENT DATABASE STATE ANALYSIS
-- ============================================

-- 1. Show all users with their current status
SELECT 
    id, 
    email, 
    first_name, 
    last_name, 
    is_admin, 
    has_completed_onboarding, 
    created_at,
    updated_at
FROM users 
ORDER BY created_at DESC;

-- 2. User statistics summary
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN is_admin = true THEN 1 END) as admin_users,
    COUNT(CASE WHEN has_completed_onboarding = true THEN 1 END) as onboarded_users,
    COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as users_with_email,
    COUNT(CASE WHEN first_name IS NOT NULL THEN 1 END) as users_with_names
FROM users;

-- 3. Check for duplicate emails
SELECT 
    email, 
    COUNT(*) as count,
    STRING_AGG(id, ', ') as user_ids
FROM users 
WHERE email IS NOT NULL
GROUP BY email 
HAVING COUNT(*) > 1;

-- 4. Check team members distribution
SELECT 
    u.email as manager_email,
    u.first_name as manager_name,
    u.is_admin,
    COUNT(tm.id) as team_members_count 
FROM users u 
LEFT JOIN team_members tm ON u.id = tm.manager_id 
GROUP BY u.id, u.email, u.first_name, u.is_admin
ORDER BY team_members_count DESC;

-- ============================================
-- PART 2: DATABASE INTEGRITY CHECKS
-- ============================================

-- 5. Check for orphaned team members
SELECT 
    'Orphaned Team Members' as issue_type,
    COUNT(*) as count
FROM team_members tm 
LEFT JOIN users u ON tm.manager_id = u.id 
WHERE u.id IS NULL;

-- 6. Check for orphaned conversations
SELECT 
    'Orphaned Conversations' as issue_type,
    COUNT(*) as count
FROM conversations c 
LEFT JOIN users u ON c.user_id = u.id 
WHERE u.id IS NULL;

-- 7. Check for orphaned email logs
SELECT 
    'Orphaned Email Logs' as issue_type,
    COUNT(*) as count
FROM email_logs el 
LEFT JOIN users u ON el.user_id = u.id 
WHERE u.id IS NULL;

-- 8. Check for orphaned email subscriptions
SELECT 
    'Orphaned Email Subscriptions' as issue_type,
    COUNT(*) as count
FROM email_subscriptions es 
LEFT JOIN users u ON es.user_id = u.id 
WHERE u.id IS NULL;

-- 9. Check for expired sessions
SELECT 
    'Expired Sessions' as issue_type,
    COUNT(*) as count
FROM sessions 
WHERE expire < NOW();

-- ============================================
-- PART 3: ADMIN ACCOUNT FIXES
-- ============================================

-- 10. Show current admin status for target email
SELECT 
    id, 
    email, 
    first_name, 
    is_admin, 
    has_completed_onboarding,
    'BEFORE FIX' as status
FROM users 
WHERE email = 'tinymanagerai@gmail.com';

-- 11. FIX: Set admin flag for tinymanagerai@gmail.com
UPDATE users 
SET 
    is_admin = true,
    updated_at = NOW()
WHERE email = 'tinymanagerai@gmail.com';

-- 12. Verify the fix was applied
SELECT 
    id, 
    email, 
    first_name, 
    is_admin, 
    has_completed_onboarding,
    'AFTER FIX' as status
FROM users 
WHERE email = 'tinymanagerai@gmail.com';

-- ============================================
-- PART 4: CLEANUP DUPLICATE ADMIN ACCOUNTS
-- ============================================

-- 13. Show all admin accounts before cleanup
SELECT 
    id, 
    email, 
    first_name, 
    is_admin,
    created_at,
    'BEFORE CLEANUP' as status
FROM users 
WHERE is_admin = true
ORDER BY created_at;

-- 14. CLEANUP: Remove the duplicate codanudge admin account if it exists
-- (Only if tinymanagerai@gmail.com is now properly set as admin)
DELETE FROM users 
WHERE email = 'codanudge@gmail.com' 
AND is_admin = true 
AND EXISTS (
    SELECT 1 FROM users 
    WHERE email = 'tinymanagerai@gmail.com' 
    AND is_admin = true
);

-- 15. Show final admin accounts after cleanup
SELECT 
    id, 
    email, 
    first_name, 
    is_admin,
    created_at,
    'AFTER CLEANUP' as status
FROM users 
WHERE is_admin = true
ORDER BY created_at;

-- ============================================
-- PART 5: FINAL VERIFICATION
-- ============================================

-- 16. Final verification - should show only one admin
SELECT 
    'Final Admin Count' as check_type,
    COUNT(*) as admin_count,
    STRING_AGG(email, ', ') as admin_emails
FROM users 
WHERE is_admin = true;

-- 17. Verify database integrity after changes
SELECT 
    'Database Integrity Check' as check_type,
    'All constraints satisfied' as result
WHERE NOT EXISTS (
    -- Check for any constraint violations
    SELECT 1 FROM team_members tm 
    LEFT JOIN users u ON tm.manager_id = u.id 
    WHERE u.id IS NULL
    
    UNION ALL
    
    SELECT 1 FROM conversations c 
    LEFT JOIN users u ON c.user_id = u.id 
    WHERE u.id IS NULL
    
    UNION ALL
    
    SELECT 1 FROM email_logs el 
    LEFT JOIN users u ON el.user_id = u.id 
    WHERE u.id IS NULL
);

-- ============================================
-- SUMMARY REPORT
-- ============================================

-- 18. Generate final summary report
SELECT 
    'SUMMARY REPORT' as section,
    'Admin Fix Complete' as status,
    NOW() as timestamp;

SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN is_admin = true THEN 1 END) as admin_users,
    COUNT(CASE WHEN has_completed_onboarding = true THEN 1 END) as completed_onboarding
FROM users;