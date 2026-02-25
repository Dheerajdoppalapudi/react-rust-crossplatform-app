import json
import re
import random
from pathlib import Path
from typing import Optional

from llm_service import default_llm_service
from db import (
    init_db,
    get_nodes_as_catalog_text,
    get_node_by_name,
    insert_node,
    increment_document_frequency,
    get_all_nodes,
)
from pdf_extractor import extract_and_clean, get_all_pdfs

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = Path("prompt.md").read_text(encoding="utf-8")


def _build_user_prompt(catalog: str, sop_content: str) -> str:
    return f"""## EXISTING NODE CATALOG
{catalog}

---

## SOP CONTENT
{sop_content}
"""


# ---------------------------------------------------------------------------
# LLM response parsing
# ---------------------------------------------------------------------------

def _parse_response(raw: str) -> Optional[dict]:
    """
    Extract the JSON object from the LLM response.
    Handles cases where the model wraps output in markdown code fences.
    """
    if not raw:
        return None

    # Strip markdown code fences if present
    raw = re.sub(r'^```(?:json)?\s*', '', raw.strip(), flags=re.MULTILINE)
    raw = re.sub(r'```\s*$', '', raw.strip(), flags=re.MULTILINE)

    # Find the first {...} block
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not match:
        return None

    try:
        return json.loads(match.group())
    except json.JSONDecodeError as e:
        print(f"  [Parser] JSON decode error: {e}")
        return None


# ---------------------------------------------------------------------------
# Core: process a single document
# ---------------------------------------------------------------------------

def process_document(pdf_path: str) -> dict:
    """
    Full pipeline for one PDF:
      1. Extract + clean text
      2. Build prompt with current node catalog
      3. Call LLM
      4. Parse response
      5. Update DB (increment freq for used nodes, insert new nodes)

    Returns a summary dict of what happened.
    """
    name = Path(pdf_path).name
    print(f"\n{'─'*60}")
    print(f"  Processing: {name}")

    result = {
        "file": name,
        "summary": "",
        "used_nodes": [],
        "new_nodes": [],
        "errors": [],
    }

    # Step 1 — Extract text
    sop_text = extract_and_clean(pdf_path)
    if not sop_text:
        result["errors"].append("PDF extraction failed or returned empty text.")
        print(f"  [SKIP] Could not extract text.")
        return result

    # Step 2 — Build prompt with the CURRENT catalog (grows as docs are processed)
    catalog = get_nodes_as_catalog_text()
    user_prompt = _build_user_prompt(catalog, sop_text)

    # Step 3 — LLM call
    print(f"  Calling LLM...")
    raw_response = default_llm_service.make_system_user_request(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=user_prompt,
    )

    if not raw_response:
        result["errors"].append("LLM returned empty response.")
        print(f"  [SKIP] LLM call failed.")
        return result

    # Step 4 — Parse
    parsed = _parse_response(raw_response)
    if not parsed:
        result["errors"].append("Could not parse LLM response as JSON.")
        print(f"  [SKIP] Response was not valid JSON.")
        print(f"  Raw response (first 300 chars): {raw_response[:300]}")
        return result

    result["summary"] = parsed.get("summary", "")

    # Step 5a — Update frequency for used existing nodes
    used = parsed.get("used_nodes", [])
    for node_name in used:
        existing = get_node_by_name(node_name)
        if existing:
            increment_document_frequency(node_name)
            result["used_nodes"].append(node_name)
        else:
            print(f"  [WARN] LLM referenced unknown node: '{node_name}' — skipping.")

    # Step 5b — Insert newly discovered nodes
    new_nodes = parsed.get("new_nodes", [])
    for new_node in new_nodes:
        node_name = new_node.get("name", "").strip()
        if not node_name:
            continue

        existing = get_node_by_name(node_name)
        if existing:
            # Already in DB (discovered by a previous doc) — just increment
            increment_document_frequency(node_name)
            result["used_nodes"].append(node_name)
            print(f"  [EXISTS] '{node_name}' already discovered — incremented frequency.")
        else:
            insert_node(
                name=node_name,
                description=new_node.get("description", ""),
                category=new_node.get("category", "Connectors"),
                inputs=new_node.get("inputs", []),
                outputs=new_node.get("outputs", []),
            )
            result["new_nodes"].append(node_name)
            print(f"  [NEW NODE] Discovered: '{node_name}' [{new_node.get('category')}]")

    print(f"  Summary : {result['summary']}")
    print(f"  Used     : {len(result['used_nodes'])} nodes")
    print(f"  New      : {len(result['new_nodes'])} nodes")

    return result


# ---------------------------------------------------------------------------
# Batch runner
# ---------------------------------------------------------------------------

def run_discovery(docs_dir: str = "SOP_Documents", sample_size: int = 100, shuffle: bool = True):
    """
    Process up to `sample_size` PDFs from `docs_dir`.
    If shuffle=True, picks a random sample (good for diverse coverage).
    """
    init_db()

    pdfs = get_all_pdfs(docs_dir)
    if not pdfs:
        print(f"[Discovery] No PDFs found in '{docs_dir}'. Add documents and re-run.")
        return

    if shuffle:
        random.shuffle(pdfs)

    sample = pdfs[:sample_size]

    print(f"\n{'='*60}")
    print(f"  NODE DISCOVERY RUN")
    print(f"  Total PDFs found : {len(pdfs)}")
    print(f"  Processing       : {len(sample)}")
    print(f"{'='*60}")

    all_results = []
    for i, pdf_path in enumerate(sample, 1):
        print(f"\n[{i}/{len(sample)}]", end="")
        result = process_document(str(pdf_path))
        all_results.append(result)

    _print_final_report(all_results)


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def _print_final_report(results: list):
    all_nodes = get_all_nodes()
    base_nodes       = [n for n in all_nodes if not n["is_discovered"]]
    discovered_nodes = [n for n in all_nodes if n["is_discovered"]]
    errors           = [r for r in results if r["errors"]]

    print(f"\n\n{'='*60}")
    print(f"  DISCOVERY COMPLETE")
    print(f"{'='*60}")
    print(f"  Documents processed : {len(results)}")
    print(f"  Documents with errors: {len(errors)}")
    print(f"  Base nodes          : {len(base_nodes)}")
    print(f"  Newly discovered    : {len(discovered_nodes)}")
    print(f"  Total node catalog  : {len(all_nodes)}")

    if discovered_nodes:
        print(f"\n── Newly Discovered Nodes ──────────────────────────────")
        for n in sorted(discovered_nodes, key=lambda x: -x["document_frequency"]):
            print(f"  [{n['category']:12}] {n['name']:<35} (seen in {n['document_frequency']} docs)")

    print(f"\n── Top 10 Most Used Nodes ──────────────────────────────")
    top = sorted(all_nodes, key=lambda x: -x["document_frequency"])[:10]
    for n in top:
        flag = "DISC" if n["is_discovered"] else "BASE"
        print(f"  [{flag}] {n['name']:<35} freq={n['document_frequency']}")

    if errors:
        print(f"\n── Documents with Errors ───────────────────────────────")
        for r in errors:
            print(f"  {r['file']}: {r['errors']}")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    run_discovery(docs_dir="SOP_Documents", sample_size=100, shuffle=True)
