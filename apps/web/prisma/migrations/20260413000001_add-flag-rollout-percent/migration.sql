-- AlterTable: add gradual rollout percentage to feature flags
ALTER TABLE "feature_flags"
  ADD COLUMN "rolloutPercent" INTEGER NOT NULL DEFAULT 0;

-- Seed the RADICAL_UX feature flag (starts disabled, 0% rollout)
-- ON CONFLICT DO NOTHING makes this safe to re-run.
INSERT INTO "feature_flags" ("id", "key", "enabled", "rolloutPercent", "description", "updatedAt")
VALUES (
  'clradicalux00000000000001',
  'RADICAL_UX',
  false,
  0,
  'Enables the new Radical UX: 3-column desktop layout, mobile bottom nav, microblogging with 4 post types (Away, Thought, Quote, Photo). Toggle OFF to instantly restore the old UX for all users.',
  now()
)
ON CONFLICT ("key") DO NOTHING;
