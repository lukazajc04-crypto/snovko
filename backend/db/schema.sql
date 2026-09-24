CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'parent' CHECK (role IN ('parent', 'child')),
  stripe_customer_id TEXT UNIQUE,
  subscription_id    TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS children (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id   INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name      TEXT    NOT NULL,
  grade     INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 9),
  subjects    TEXT  NOT NULL DEFAULT '[]',
  access_code TEXT  NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS credits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance    INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  plan       TEXT    CHECK (plan IN ('basic', 'standard', 'family')),
  reset_date TEXT
);

CREATE TABLE IF NOT EXISTS generations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id     INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  subject      TEXT    NOT NULL,
  content_json TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quiz_results (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  generation_id INTEGER NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  score         INTEGER NOT NULL CHECK (score >= 0),
  total         INTEGER NOT NULL CHECK (total > 0),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS worksheet_checks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id    INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  subject     TEXT    NOT NULL,
  image_file  TEXT    NOT NULL,
  result_json TEXT    NOT NULL,
  correct     INTEGER NOT NULL,
  total       INTEGER NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Žeton za ponastavitev gesla. Hranimo samo zgoščeno vrednost — kdor bi prišel do
-- baze, iz nje ne more sestaviti veljavne povezave.
CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT    NOT NULL UNIQUE,
  expires_at TEXT    NOT NULL,
  used_at    TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Zanimanje za funkcije, ki jih še ni (npr. video razlaga) — da se odloča po
-- številkah in ne po občutku
CREATE TABLE IF NOT EXISTS feature_interest (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature    TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, feature)
);

-- Učni list z nalogami, ustvarjen iz gradiva. Rešitve so v istem zapisu, a jih
-- API pošlje samo staršu — otrok dobi list brez odgovorov.
CREATE TABLE IF NOT EXISTS exercise_sheets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  generation_id INTEGER NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  child_id      INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  content_json  TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Prislužene značke se shranijo, ker ostanejo trajno: niz 7 dni je bil dosežen,
-- tudi ko se kasneje prekine
CREATE TABLE IF NOT EXISTS badges (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id  INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  code      TEXT    NOT NULL,
  earned_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (child_id, code)
);

CREATE INDEX IF NOT EXISTS idx_children_parent   ON children(parent_id);
CREATE INDEX IF NOT EXISTS idx_checks_child      ON worksheet_checks(child_id, created_at);
CREATE INDEX IF NOT EXISTS idx_generations_child ON generations(child_id, created_at);
CREATE INDEX IF NOT EXISTS idx_quiz_generation   ON quiz_results(generation_id);
CREATE INDEX IF NOT EXISTS idx_sheets_generation ON exercise_sheets(generation_id);
