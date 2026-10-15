/*
# Add blood flow tracking to periods

Adds a `blood_flow` column to the `periods` table so users can record
their menstrual flow intensity (spotting, light, medium, heavy) alongside
each period log. This column is nullable so existing period records are
unaffected.

## Modified Tables
- `periods` — new `blood_flow` text column (values: 'spotting', 'light', 'medium', 'heavy')

## Security
- No policy changes needed; the column is covered by existing owner-scoped RLS.
*/

ALTER TABLE periods ADD COLUMN IF NOT EXISTS blood_flow text;