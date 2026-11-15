export const applicationSchema = `
  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY, name TEXT NOT NULL, time_zone TEXT NOT NULL DEFAULT 'America/Chicago',
    color TEXT NOT NULL DEFAULT '#416B67', available_from INTEGER NOT NULL DEFAULT 18,
    available_to INTEGER NOT NULL DEFAULT 22, is_demo INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS memberships (
    user_id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    slot INTEGER NOT NULL CHECK(slot IN (1,2)), UNIQUE(space_id,slot)
  );
  CREATE TABLE IF NOT EXISTS invitations (
    token_hash TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS resources (
    id TEXT NOT NULL, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, author_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(space_id,id)
  );
  CREATE INDEX IF NOT EXISTS resources_space_kind ON resources(space_id,kind,created_at);
  CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL, filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS demo_rooms (
    token_hash TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS demo_credentials (
    user_id TEXT PRIMARY KEY, email TEXT NOT NULL, credential TEXT NOT NULL,
    space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pair_history (space_id TEXT PRIMARY KEY REFERENCES spaces(id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS media_deletions (
    filename TEXT PRIMARY KEY, space_id TEXT NOT NULL, created_at TEXT NOT NULL
  );
`;
