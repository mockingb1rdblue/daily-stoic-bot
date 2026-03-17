# Scripts

## parse-entries.py
One-time parser that extracts 366 entries from The Daily Stoic DjVu text file.
Handles OCR artifacts: drop-cap fixes, pipe character substitutions, smart quote normalization.
Output: data/entries.json

## register-commands.mjs
Registers Discord slash commands with the Discord API.
Usage: `node scripts/register-commands.mjs [development|production]`
Reads credentials from env vars or Bifrost KV.
