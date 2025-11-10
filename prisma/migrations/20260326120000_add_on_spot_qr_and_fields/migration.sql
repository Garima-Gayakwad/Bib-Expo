-- Add QR + on-spot support fields.
-- Use IF NOT EXISTS for safe execution on partially-updated databases.

ALTER TABLE "ExpoEvent"
ADD COLUMN IF NOT EXISTS "onSpotQrCode" TEXT;

ALTER TABLE "Participant"
ADD COLUMN IF NOT EXISTS "dateOfBirth" TEXT;

ALTER TABLE "Participant"
ADD COLUMN IF NOT EXISTS "transponderNumber" TEXT;

ALTER TABLE "Participant"
ADD COLUMN IF NOT EXISTS "extraFields" JSONB;

