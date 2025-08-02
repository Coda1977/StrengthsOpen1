-- EMERGENCY SAFETY MIGRATION
-- This migration removes dangerous CASCADE deletions and adds safety measures
-- Created after mass user deletion incident

-- 1. Remove CASCADE deletion constraints (replace with RESTRICT)
-- This prevents accidental mass deletions via foreign key cascades

-- Team Members table
ALTER TABLE team_members 
DROP CONSTRAINT IF EXISTS team_members_manager_id_users_id_fk,
ADD CONSTRAINT team_members_manager_id_users_id_fk 
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE RESTRICT;

-- Conversations table (assuming it has userId reference)
ALTER TABLE conversations 
DROP CONSTRAINT IF EXISTS conversations_user_id_users_id_fk,
ADD CONSTRAINT conversations_user_id_users_id_fk 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

-- Messages table
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_conversation_id_conversations_id_fk,
ADD CONSTRAINT messages_conversation_id_conversations_id_fk 
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE RESTRICT;

-- Email Subscriptions table
ALTER TABLE email_subscriptions 
DROP CONSTRAINT IF EXISTS email_subscriptions_user_id_users_id_fk,
ADD CONSTRAINT email_subscriptions_user_id_users_id_fk 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

-- Email Logs table
ALTER TABLE email_logs 
DROP CONSTRAINT IF EXISTS email_logs_user_id_users_id_fk,
ADD CONSTRAINT email_logs_user_id_users_id_fk 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

-- OpenAI Usage Logs table
ALTER TABLE openai_usage_logs 
DROP CONSTRAINT IF EXISTS openai_usage_logs_user_id_users_id_fk,
ADD CONSTRAINT openai_usage_logs_user_id_users_id_fk 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

-- Unsubscribe Tokens table
ALTER TABLE unsubscribe_tokens 
DROP CONSTRAINT IF EXISTS unsubscribe_tokens_user_id_users_id_fk,
ADD CONSTRAINT unsubscribe_tokens_user_id_users_id_fk 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

-- 2. Add soft delete columns to users table for safe deletion
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_reason TEXT,
ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);

-- 3. Create admin action log table for auditing dangerous operations
CREATE TABLE IF NOT EXISTS admin_action_logs (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_user_id VARCHAR(255) NOT NULL,
  admin_email VARCHAR(255) NOT NULL,
  action_type VARCHAR(100) NOT NULL, -- 'delete_user', 'bulk_operation', etc.
  target_user_id VARCHAR(255),
  target_identifier VARCHAR(255), -- email or other identifier
  action_details JSONB,
  reason TEXT,
  environment VARCHAR(50) NOT NULL, -- 'development', 'production'
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'attempted' -- 'attempted', 'completed', 'failed', 'blocked'
);

-- Index for admin action logs
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_admin_user 
  ON admin_action_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at 
  ON admin_action_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_action_type 
  ON admin_action_logs(action_type);

-- 4. Create data backup log table
CREATE TABLE IF NOT EXISTS backup_logs (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  backup_type VARCHAR(50) NOT NULL, -- 'full', 'incremental', 'emergency'
  file_path TEXT,
  file_size BIGINT,
  record_counts JSONB, -- counts of each table backed up
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255), -- 'system', 'admin', 'automated'
  status VARCHAR(50) DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed'
  error_message TEXT
);

-- Index for backup logs
CREATE INDEX IF NOT EXISTS idx_backup_logs_created_at 
  ON backup_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_backup_logs_backup_type 
  ON backup_logs(backup_type);

-- 5. Update conversation_backups to NOT reference users with CASCADE
-- This table should preserve backups even if users are deleted
ALTER TABLE conversation_backups 
DROP CONSTRAINT IF EXISTS conversation_backups_user_id_users_id_fk;

-- Add a non-enforced reference (just for documentation)
-- This allows orphaned backups to exist for recovery purposes
ALTER TABLE conversation_backups 
ADD CONSTRAINT conversation_backups_user_id_note 
  CHECK (user_id IS NOT NULL);

COMMENT ON COLUMN conversation_backups.user_id IS 
  'User ID reference - not enforced to allow recovery from deleted users';

-- 6. Create a view for active (non-deleted) users
CREATE OR REPLACE VIEW active_users AS
SELECT * FROM users 
WHERE deleted_at IS NULL;

-- 7. Create emergency contact information table
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  contact_type VARCHAR(50) NOT NULL, -- 'admin', 'developer', 'support'
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Insert default emergency contact (replace with actual contact)
INSERT INTO emergency_contacts (contact_type, name, email, role, notes) 
VALUES (
  'admin', 
  'System Administrator', 
  'tinymanagerai@gmail.com', 
  'Primary Admin',
  'Contact for database emergencies and user data recovery'
) ON CONFLICT DO NOTHING;

-- 8. Log this migration
INSERT INTO admin_action_logs (
  admin_user_id, 
  admin_email, 
  action_type, 
  action_details, 
  reason, 
  environment,
  status
) VALUES (
  'system',
  'system@automated',
  'safety_migration',
  '{"migration": "emergency-safety-migration.sql", "changes": ["removed_cascade_deletions", "added_soft_delete", "added_audit_logging"]}',
  'Emergency safety measures after mass user deletion incident',
  COALESCE(current_setting('app.environment', true), 'unknown'),
  'completed'
);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ EMERGENCY SAFETY MIGRATION COMPLETED';
  RAISE NOTICE '🛡️  CASCADE deletions removed';
  RAISE NOTICE '📊 Audit logging enabled';
  RAISE NOTICE '💾 Backup system tables created';
  RAISE NOTICE '🔒 Soft delete system ready';
END $$;