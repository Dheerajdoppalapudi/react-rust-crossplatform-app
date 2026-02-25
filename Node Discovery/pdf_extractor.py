import re
import pdfplumber
from pathlib import Path
from typing import Optional

# Maximum characters sent to the LLM — keeps token usage sane for large SOPs
MAX_CHARS = 8000


def extract_text_from_pdf(pdf_path: str) -> Optional[str]:
    """
    Extract raw text from all pages of a PDF.
    Returns None if the file cannot be read.
    """
    try:
        pages = []
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
        return "\n".join(pages)
    except Exception as e:
        print(f"[PDFExtractor] Failed to read {pdf_path}: {e}")
        return None


def clean_text(text: str) -> str:
    """
    Remove PDF noise so the LLM gets only meaningful SOP content.

    Removes:
      - Page number lines  (e.g. "Page 1 of 10", "- 3 -")
      - Horizontal rules   (e.g. "─────", "=====")
      - Excessive blank lines (3+ → 2)
      - Leading/trailing whitespace per line
    """
    # Drop common page-number patterns
    text = re.sub(r'(?im)^\s*(page\s+\d+\s*(of\s*\d+)?|-+\s*\d+\s*-+)\s*$', '', text)

    # Drop lines that are purely decorative (dashes, equals, underscores ≥ 4 chars)
    text = re.sub(r'(?m)^\s*[-=_]{4,}\s*$', '', text)

    # Collapse 3+ consecutive blank lines into 2
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Strip trailing spaces on each line
    text = '\n'.join(line.rstrip() for line in text.splitlines())

    return text.strip()


def extract_and_clean(pdf_path: str) -> Optional[str]:
    """
    Full pipeline: extract → clean → truncate.
    Returns cleaned text or None on failure.
    """
    raw = extract_text_from_pdf(pdf_path)
    if raw is None:
        return None

    cleaned = clean_text(raw)

    if len(cleaned) > MAX_CHARS:
        cleaned = cleaned[:MAX_CHARS] + "\n\n[... document truncated ...]"

    return cleaned


def get_all_pdfs(docs_dir: str = "SOP_Documents") -> list[Path]:
    """Return all PDF paths under docs_dir, sorted by name."""
    return sorted(Path(docs_dir).glob("**/*.pdf"))


# ---------------------------------------------------------------------------
# Quick test — run directly to verify extraction on one file
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    pdfs = get_all_pdfs()
    if not pdfs:
        print("No PDFs found in SOP_Documents/")
    else:
        sample = pdfs[0]
        print(f"Extracting: {sample.name}\n{'─'*60}")
        text = extract_and_clean(str(sample))
        print(text or "Extraction returned nothing.")
