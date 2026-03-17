#!/usr/bin/env python3
"""
Parse The Daily Stoic DjVu text into structured JSON entries.
Source: Archive.org PDFDrive copy (DjVu OCR extraction)

Each entry has:
  - date: "January 1st" format
  - month: "January"
  - day: 1
  - day_of_year: 1-366
  - title: "CONTROL AND CHOICE"
  - quote: The Stoic quote text
  - quote_source: "EPICTETUS, DISCOURSES, 2.5.4-5"
  - commentary: Ryan Holiday's commentary text
  - part: "THE DISCIPLINE OF PERCEPTION" | "THE DISCIPLINE OF ACTION" | "THE DISCIPLINE OF WILL"
"""

import json
import re
import sys
from pathlib import Path
from datetime import datetime

SOURCES_DIR = Path(__file__).parent.parent / "sources"
DJVU_PATH = SOURCES_DIR / "archive-djvu.txt"
OUTPUT_PATH = Path(__file__).parent.parent / "data" / "entries.json"

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]  # leap year

DATE_PATTERN = re.compile(
    r'^(January|February|March|April|May|June|July|August|September|October|November|December)\s+'
    r'(\d+)(st|nd|rd|th)\s*$'
)

QUOTE_SOURCE_PATTERN = re.compile(
    r'—([A-Z][^\n]+)\s*$',
    re.MULTILINE
)

# Fallback: attribution on its own line without em-dash (e.g., "SENECA, MORAL LETTERS, 111.2")
QUOTE_SOURCE_STANDALONE = re.compile(
    r'^([A-Z]{2,}(?:\s+[A-Z]+)*,\s*[A-Z][^\n]+\d[^\n]*)\s*$',
    re.MULTILINE
)

# The book is organized into 3 parts by month ranges
PART_MAP = {
    "January": "THE DISCIPLINE OF PERCEPTION",
    "February": "THE DISCIPLINE OF PERCEPTION",
    "March": "THE DISCIPLINE OF PERCEPTION",
    "April": "THE DISCIPLINE OF PERCEPTION",
    "May": "THE DISCIPLINE OF ACTION",
    "June": "THE DISCIPLINE OF ACTION",
    "July": "THE DISCIPLINE OF ACTION",
    "August": "THE DISCIPLINE OF ACTION",
    "September": "THE DISCIPLINE OF WILL",
    "October": "THE DISCIPLINE OF WILL",
    "November": "THE DISCIPLINE OF WILL",
    "December": "THE DISCIPLINE OF WILL",
}

# Monthly themes from the book's table of contents
MONTH_THEMES = {
    "January": "Clarity",
    "February": "Passions and Emotions",
    "March": "Awareness",
    "April": "Unbiased Thought",
    "May": "Right Action",
    "June": "Problem Solving",
    "July": "Duty",
    "August": "Pragmatism",
    "September": "Fortitude and Resilience",
    "October": "Virtue and Kindness",
    "November": "Acceptance / Amor Fati",
    "December": "Meditation on Mortality",
}


def fix_drop_cap(text: str) -> str:
    """Fix OCR drop-cap artifacts where decorative first letter is separated.

    The OCR reads drop caps as a separate letter, e.g.:
      "T he single most important..." -> "The single most important..."
      "W hy did you pick up..." -> "Why did you pick up..."
    Also handles cases like "c6 O nly" -> fixes inline artifacts.
    """
    # Fix single letter followed by space at start of a line that continues a word
    text = re.sub(r'\n([A-Z]) ([a-z])', lambda m: '\n' + m.group(1) + m.group(2), text)
    # Fix at start of text
    text = re.sub(r'^([A-Z]) ([a-z])', lambda m: m.group(1) + m.group(2), text)
    return text


def fix_commentary_drop_cap(commentary: str) -> str:
    """Fix commentary that starts with a lowercase letter due to OCR drop-cap artifacts.

    The OCR separates the decorative first letter of each entry's commentary section.
    After extraction, the commentary often starts with just the tail of the word:
      "he fact that..." should be "The fact that..."
      "hy did you..." should be "Why did you..."

    Common patterns from The Daily Stoic's drop caps:
      T -> "he ", "his ", "here ", "here's ", "hink ", "hat "
      W -> "hy ", "hat ", "hen ", "e "
      A -> "nd ", "s ", " "
      I -> "t ", "n ", "f ", "t's ", "magine "
      S -> "eneca ", "ome ", "o "
      O -> "ne ", "nly ", "f ", "ur "
      E -> "pictetus ", "very ", "ven "
      P -> "eople ", "hilosophy "
    """
    if not commentary or commentary[0].isupper():
        return commentary

    # Map of common lowercase starts to their missing capital
    # These are the most frequent patterns from OCR drop-caps in The Daily Stoic
    drop_cap_fixes = {
        'he ': 'T',   'his ': 'T',  'here ': 'T',  'hink ': 'T',  'hat ': 'T',
        'here\'s ': 'T', 'hose ': 'T', 'hrough ': 'T',
        'hy ': 'W',   'hat ': 'W',  'hen ': 'W',   'e ': 'W',     'ith ': 'W',
        'hat\'s ': 'W',
        'nd ': 'A',   's ': 'A',    'ccording ': 'A', 'lexander ': 'A', 'fter ': 'A',
        't ': 'I',    'n ': 'I',    'f ': 'I',     't\'s ': 'I',  'magine ': 'I',
        'eneca ': 'S', 'ome ': 'S', 'o ': 'S',     'toic ': 'S',  'elf': 'S',
        'ne ': 'O',   'nly ': 'O',  'f ': 'O',     'ur ': 'O',    'nce ': 'O',
        'eople ': 'P', 'hilosophy ': 'P', 'art ': 'P', 'erhaps ': 'P',
        'very ': 'E',  'ven ': 'E', 'pictetus ': 'E', 'ach ': 'E',
        'arcus ': 'M', 'ost ': 'M', 'any ': 'M',
        'ou ': 'Y',   'ou\'ll ': 'Y', 'ou\'ve ': 'Y', 'es ': 'Y',
        'ot ': 'N',   'o ': 'N',    'othing ': 'N', 'ow ': 'N',
        'or ': 'F',   'ew ': 'F',   'irst ': 'F',
        'uring ': 'D', 'on\'t ': 'D', 'o ': 'D',
        'isten ': 'L', 'ife ': 'L', 'ater ': 'L', 'et ': 'L',
        'emember ': 'R', 'ead ': 'R', 'oman ': 'R',
        'onsider ': 'C', 'an ': 'C', 'ato ': 'C',
        'ust ': 'J',
        'reek ': 'G', 'od ': 'G',
        'eing ': 'B', 'ut ': 'B', 'efore ': 'B',
    }

    for suffix, capital in sorted(drop_cap_fixes.items(), key=lambda x: -len(x[0])):
        if commentary.startswith(suffix):
            return capital + commentary

    # If no match found, just capitalize the first letter
    return commentary[0].upper() + commentary[1:]


def split_into_raw_entries(text: str) -> list[tuple[int, str]]:
    """Split the full text into raw entry chunks by date headers."""
    entries = []
    lines = text.split('\n')
    current_start = None
    current_lines = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        match = DATE_PATTERN.match(stripped)
        if match:
            if current_start is not None:
                entries.append((current_start, '\n'.join(current_lines)))
            current_start = i
            current_lines = [stripped]
        elif current_start is not None:
            current_lines.append(line)

    # Don't forget the last entry
    if current_start is not None:
        entries.append((current_start, '\n'.join(current_lines)))

    return entries


def parse_entry(raw: str, day_of_year: int) -> dict:
    """Parse a raw entry chunk into structured fields."""
    lines = raw.split('\n')

    # First line is the date
    date_match = DATE_PATTERN.match(lines[0].strip())
    if not date_match:
        raise ValueError(f"Entry doesn't start with date: {lines[0]}")

    month = date_match.group(1)
    day = int(date_match.group(2))

    # Find the title (all-caps line(s) after the date)
    title_lines = []
    content_start = 1
    for i in range(1, len(lines)):
        stripped = lines[i].strip()
        if not stripped:
            continue
        # Title lines are ALL CAPS (allowing punctuation, numbers, curly/straight quotes)
        if stripped and re.match(r"^[A-Z0-9\s'\u2018\u2019\"\u201c\u201d\-\u2014,.\!\?\(\)/:\u2026=&]+$", stripped):
            title_lines.append(stripped)
            content_start = i + 1
        else:
            break

    title = ' '.join(title_lines).strip()

    # Everything after title is quote + commentary
    remaining = '\n'.join(lines[content_start:]).strip()
    remaining = fix_drop_cap(remaining)

    # Find the quote attribution (—AUTHOR, WORK, REFERENCE)
    # The quote ends at the attribution line
    quote = ""
    quote_source = ""
    commentary = ""

    # Look for the em-dash attribution pattern, fall back to standalone
    attr_match = QUOTE_SOURCE_PATTERN.search(remaining)
    if not attr_match:
        attr_match = QUOTE_SOURCE_STANDALONE.search(remaining)
    if attr_match:
        attr_pos = attr_match.start()
        quote_text = remaining[:attr_pos].strip()
        quote_source = attr_match.group(1).strip()
        commentary = remaining[attr_match.end():].strip()

        # Clean up the quote - remove surrounding quotes
        quote = quote_text.strip()
        if quote.startswith('"') or quote.startswith('\u201c'):
            quote = quote[1:]
        if quote.endswith('"') or quote.endswith('\u201d'):
            quote = quote[:-1]
        quote = quote.strip()
    else:
        # No attribution found — entire remaining is commentary
        commentary = remaining

    # Clean up commentary - remove trailing entries from next date that leaked in
    # and remove any part headers
    commentary = re.sub(r'\nPART\s+[IVX]+.*$', '', commentary, flags=re.DOTALL).strip()

    # Remove excessive whitespace
    quote = re.sub(r'\s+', ' ', quote).strip()
    commentary = re.sub(r'\n{3,}', '\n\n', commentary).strip()
    commentary = fix_commentary_drop_cap(commentary)
    quote_source = re.sub(r'\s+', ' ', quote_source).strip()

    return {
        "date": f"{month} {day}{date_match.group(3)}",
        "month": month,
        "day": day,
        "day_of_year": day_of_year,
        "title": title,
        "quote": quote,
        "quote_source": quote_source,
        "commentary": commentary,
        "part": PART_MAP.get(month, ""),
        "month_theme": MONTH_THEMES.get(month, ""),
    }


KNOWN_AUTHORS = {
    'MARCUS AURELIUS', 'SENECA', 'EPICTETUS', 'MUSONIUS RUFUS',
    'DIOGENES LAERTIUS', 'ZENO', 'HERACLITUS', 'PLUTARCH',
    'CHRYSIPPUS', 'CLEANTHES', 'HECATO', 'CATO', 'CICERO',
    'POSIDONIUS', 'PLATO', 'ANTIPATER', 'HIEROCLES', 'DEMOCRITUS',
}


def post_process(entries: list[dict]) -> list[dict]:
    """Fix known edge cases that the regex parser can't handle."""
    for e in entries:
        # Fix: Dec 31 has book afterword leaking into commentary
        if e["date"] == "December 31st":
            cut = e["commentary"].find("STAYING STOIC")
            if cut > 0:
                e["commentary"] = e["commentary"][:cut].strip()

        # Fix: some attributions are false positives (em-dash inside quotes)
        # If quote_source doesn't contain a known philosopher, it's a false match
        if e["quote_source"]:
            author_part = e["quote_source"].split(",")[0].strip().upper()
            is_known = any(a in author_part for a in KNOWN_AUTHORS)
            # Also reject if "author" contains lowercase words (it's a sentence, not a citation)
            has_lowercase = bool(re.search(r'\b[a-z]{3,}\b', e["quote_source"]))
            if not is_known or has_lowercase:
                # The "attribution" was actually part of the quote — merge it back
                e["quote"] = e["quote"] + "\u2014" + e["quote_source"]
                e["quote_source"] = ""
                # Now try to find the real attribution in the commentary
                attr_match = QUOTE_SOURCE_PATTERN.search(e["commentary"])
                if attr_match:
                    # Split commentary at the real attribution
                    extra_quote = e["commentary"][:attr_match.start()].strip()
                    e["quote"] = e["quote"] + " " + extra_quote
                    e["quote_source"] = attr_match.group(1).strip()
                    e["commentary"] = e["commentary"][attr_match.end():].strip()
                    # Clean quote
                    e["quote"] = re.sub(r'\s+', ' ', e["quote"]).strip()
                    if e["quote"].endswith('"') or e["quote"].endswith('\u201d'):
                        e["quote"] = e["quote"][:-1].strip()

        # Fix: clean up commentary - normalize whitespace + drop cap
        e["commentary"] = re.sub(r'\n{3,}', '\n\n', e["commentary"]).strip()
        e["commentary"] = fix_commentary_drop_cap(e["commentary"])

    return entries


def validate_entries(entries: list[dict]) -> list[str]:
    """Validate the parsed entries for completeness and quality."""
    issues = []

    if len(entries) != 366:
        issues.append(f"Expected 366 entries, got {len(entries)}")

    # Check each month has the right number of days
    month_counts = {}
    for e in entries:
        month_counts[e["month"]] = month_counts.get(e["month"], 0) + 1

    for i, month in enumerate(MONTHS):
        expected = DAYS_IN_MONTH[i]
        actual = month_counts.get(month, 0)
        if actual != expected:
            issues.append(f"{month}: expected {expected} entries, got {actual}")

    # Check for empty fields
    for e in entries:
        if not e["title"]:
            issues.append(f"{e['date']}: missing title")
        if not e["quote"]:
            issues.append(f"{e['date']}: missing quote")
        if not e["quote_source"]:
            issues.append(f"{e['date']}: missing quote_source")
        if not e["commentary"]:
            issues.append(f"{e['date']}: missing commentary")
        if len(e["commentary"]) < 50:
            issues.append(f"{e['date']}: commentary suspiciously short ({len(e['commentary'])} chars)")

    # Check day_of_year is sequential
    for i, e in enumerate(entries):
        if e["day_of_year"] != i + 1:
            issues.append(f"{e['date']}: day_of_year {e['day_of_year']} != expected {i + 1}")

    return issues


def main():
    print("Reading DjVu text...")
    text = DJVU_PATH.read_text(encoding='utf-8')

    print("Splitting into raw entries...")
    raw_entries = split_into_raw_entries(text)
    print(f"Found {len(raw_entries)} raw entries")

    print("Parsing entries...")
    entries = []
    day_of_year = 1
    for line_num, raw in raw_entries:
        try:
            entry = parse_entry(raw, day_of_year)
            entries.append(entry)
            day_of_year += 1
        except Exception as e:
            print(f"  ERROR at line {line_num}: {e}")
            print(f"  Raw start: {raw[:100]}")

    print(f"\nParsed {len(entries)} entries")

    print("Post-processing...")
    entries = post_process(entries)

    # Validate
    print("\nValidating...")
    issues = validate_entries(entries)
    if issues:
        print(f"\n{len(issues)} issues found:")
        for issue in issues[:30]:
            print(f"  - {issue}")
        if len(issues) > 30:
            print(f"  ... and {len(issues) - 30} more")
    else:
        print("All validations passed!")

    # Write output
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(entries, indent=2, ensure_ascii=False),
        encoding='utf-8'
    )
    print(f"\nWrote {len(entries)} entries to {OUTPUT_PATH}")

    # Print sample
    print("\n=== SAMPLE ENTRY (January 1st) ===")
    print(json.dumps(entries[0], indent=2, ensure_ascii=False))

    print("\n=== SAMPLE ENTRY (June 15th) ===")
    june_15 = next((e for e in entries if e["date"] == "June 15th"), None)
    if june_15:
        print(json.dumps(june_15, indent=2, ensure_ascii=False))

    print("\n=== SAMPLE ENTRY (December 31st) ===")
    print(json.dumps(entries[-1], indent=2, ensure_ascii=False))

    # Stats
    print("\n=== STATS ===")
    avg_quote_len = sum(len(e["quote"]) for e in entries) / len(entries)
    avg_commentary_len = sum(len(e["commentary"]) for e in entries) / len(entries)
    sources = {}
    for e in entries:
        author = e["quote_source"].split(",")[0].strip() if e["quote_source"] else "UNKNOWN"
        sources[author] = sources.get(author, 0) + 1

    print(f"Avg quote length: {avg_quote_len:.0f} chars")
    print(f"Avg commentary length: {avg_commentary_len:.0f} chars")
    print(f"\nTop quote sources:")
    for author, count in sorted(sources.items(), key=lambda x: -x[1])[:10]:
        print(f"  {author}: {count}")


if __name__ == "__main__":
    main()
