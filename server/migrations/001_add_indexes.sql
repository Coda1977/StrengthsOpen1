-- Performance optimization indexes for frequently queried columns
-- Run this migration to improve query performance

-- Index on team_members.manager_id for efficient team member lookups
CREATE INDEX IF NOT EXISTS idx_team_members_manager_id ON team_members(manager_id);

-- Index on team_members.name for searching team members by name
CREATE INDEX IF NOT EXISTS idx_team_members_name ON team_members(name);

-- Composite index for team member operations (manager_id + name for uniqueness checks)
CREATE INDEX IF NOT EXISTS idx_team_members_manager_name ON team_members(manager_id, name);

-- Index on users.email for authentication lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index on users.has_completed_onboarding for filtering users by onboarding status
CREATE INDEX IF NOT EXISTS idx_users_onboarding_status ON users(has_completed_onboarding);

-- Index on sessions.sid for session lookups (if not already exists)
CREATE INDEX IF NOT EXISTS idx_sessions_sid ON sessions(sid);

-- Index on sessions.expire for session cleanup
CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);

-- Partial index for active sessions (not expired)
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(sid, expire) 
WHERE expire > NOW();

-- Index for team member strengths array operations (GIN index for array operations)
CREATE INDEX IF NOT EXISTS idx_team_members_strengths_gin ON team_members USING GIN(strengths);

-- Statistics update to help query planner make better decisions
ANALYZE team_members;
ANALYZE users;
ANALYZE sessions;