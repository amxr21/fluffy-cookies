-- Refresh sessions, so logout actually revokes.
--
-- The app issued one long-lived (7d) JWT and stored it in localStorage. Two
-- problems: any XSS reads it and takes over the account, and "sign out" only
-- cleared the browser's copy — a token already captured stayed valid for its
-- full lifetime, because nothing server-side could say otherwise.
--
-- The new shape is a short access token (15m) plus a refresh token recorded
-- here. The access token stays stateless and cheap to verify; the refresh token
-- is a row that can be deleted, which is what makes revocation real.

CREATE TABLE IF NOT EXISTS sessions (
  id             CHAR(36) PRIMARY KEY,
  user_id        INT NOT NULL,

  -- SHA-256 of the refresh token, never the token itself. A leaked database
  -- backup must not hand over working sessions, and the hash is all the server
  -- needs to check a presented token.
  token_hash     CHAR(64) NOT NULL,

  -- Rotation family. Every refresh issues a new token in the same family; if a
  -- token that was already used comes back, the whole family is revoked because
  -- it means a copy is in someone else's hands.
  family_id      CHAR(36) NOT NULL,

  -- Set when the token is exchanged. A non-NULL value arriving again is the
  -- reuse signal.
  used_at        TIMESTAMP NULL DEFAULT NULL,
  revoked_at     TIMESTAMP NULL DEFAULT NULL,

  expires_at     TIMESTAMP NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Kept for the "sign out everywhere" screen: a person recognises their own
  -- devices by these, and they make a stolen session visible.
  user_agent     VARCHAR(255) NULL,
  ip             VARCHAR(45) NULL,

  UNIQUE KEY uq_sessions_token_hash (token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_family (family_id),
  KEY idx_sessions_expires (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Bumping this invalidates every access token already issued to a user, without
-- waiting for them to expire. Needed for a role change or a forced sign-out:
-- the access token is stateless, so the only way to reject it early is to make
-- the claim it carries stale.
ALTER TABLE users
  ADD COLUMN token_version INT NOT NULL DEFAULT 0 AFTER role;
