import sqlite3
import json
from typing import List, Dict, Optional, Any

DB_PATH = "nodes.db"

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

CREATE_NODES_TABLE = """
CREATE TABLE IF NOT EXISTS nodes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT    NOT NULL UNIQUE,
    description         TEXT,
    category            TEXT,
    inputs              TEXT    DEFAULT '[]',   -- JSON: [{name, type}]
    outputs             TEXT    DEFAULT '[]',   -- JSON: [{name, type}]
    document_frequency  INTEGER DEFAULT 0,      -- count of docs this node appeared in
    is_discovered       INTEGER DEFAULT 0       -- 0 = pre-seeded, 1 = discovered from docs
)
"""

# ---------------------------------------------------------------------------
# Seed data  (is_discovered = 0 for all base nodes)
# ---------------------------------------------------------------------------

SEED_NODES: List[Dict[str, Any]] = [
    # ── Connectors ─────────────────────────────────────────────────────────
    {
        "name": "Send Email",
        "description": "Sends an email via SMTP or an email provider.",
        "category": "Connectors",
        "inputs":  [{"name": "to", "type": "string"}, {"name": "subject", "type": "string"}, {"name": "body", "type": "string"}],
        "outputs": [{"name": "status", "type": "string"}, {"name": "message_id", "type": "string"}],
    },
    {
        "name": "HTTP Request",
        "description": "Makes an outbound HTTP/HTTPS call (GET, POST, PUT, DELETE, etc.).",
        "category": "Connectors",
        "inputs":  [{"name": "url", "type": "string"}, {"name": "method", "type": "string"}, {"name": "headers", "type": "object"}, {"name": "body", "type": "object"}],
        "outputs": [{"name": "response_body", "type": "object"}, {"name": "status_code", "type": "integer"}],
    },
    {
        "name": "Read File",
        "description": "Reads a file from S3, SharePoint, or local storage.",
        "category": "Connectors",
        "inputs":  [{"name": "path", "type": "string"}, {"name": "format", "type": "string"}],
        "outputs": [{"name": "content", "type": "any"}, {"name": "metadata", "type": "object"}],
    },
    {
        "name": "Write File",
        "description": "Writes or uploads a file to S3, SharePoint, or local storage.",
        "category": "Connectors",
        "inputs":  [{"name": "path", "type": "string"}, {"name": "content", "type": "any"}, {"name": "format", "type": "string"}],
        "outputs": [{"name": "success", "type": "boolean"}, {"name": "file_url", "type": "string"}],
    },
    {
        "name": "Database Query",
        "description": "Executes a SQL query against a relational database.",
        "category": "Connectors",
        "inputs":  [{"name": "query", "type": "string"}, {"name": "params", "type": "array"}],
        "outputs": [{"name": "rows", "type": "array"}, {"name": "row_count", "type": "integer"}],
    },
    {
        "name": "Queue Publish",
        "description": "Publishes a message to a queue (SQS, RabbitMQ, Kafka, etc.).",
        "category": "Connectors",
        "inputs":  [{"name": "queue_name", "type": "string"}, {"name": "message", "type": "object"}],
        "outputs": [{"name": "message_id", "type": "string"}, {"name": "status", "type": "string"}],
    },
    {
        "name": "Queue Consume",
        "description": "Reads messages from a queue and triggers downstream nodes.",
        "category": "Connectors",
        "inputs":  [{"name": "queue_name", "type": "string"}, {"name": "batch_size", "type": "integer"}],
        "outputs": [{"name": "messages", "type": "array"}, {"name": "count", "type": "integer"}],
    },

    # ── Data ────────────────────────────────────────────────────────────────
    {
        "name": "Parse",
        "description": "Parses raw content (JSON, XML, CSV, text) into a structured object.",
        "category": "Data",
        "inputs":  [{"name": "raw_content", "type": "string"}, {"name": "format", "type": "string"}],
        "outputs": [{"name": "parsed_data", "type": "object"}],
    },
    {
        "name": "Transform",
        "description": "Applies a mapping or transformation rule to reshape data.",
        "category": "Data",
        "inputs":  [{"name": "data", "type": "object"}, {"name": "mapping", "type": "object"}],
        "outputs": [{"name": "transformed_data", "type": "object"}],
    },
    {
        "name": "Filter",
        "description": "Filters a list of records based on a condition expression.",
        "category": "Data",
        "inputs":  [{"name": "records", "type": "array"}, {"name": "condition", "type": "string"}],
        "outputs": [{"name": "matched", "type": "array"}, {"name": "unmatched", "type": "array"}],
    },
    {
        "name": "Join",
        "description": "Joins two datasets on a common key (inner, left, outer).",
        "category": "Data",
        "inputs":  [{"name": "left_data", "type": "array"}, {"name": "right_data", "type": "array"}, {"name": "join_key", "type": "string"}, {"name": "join_type", "type": "string"}],
        "outputs": [{"name": "result", "type": "array"}],
    },
    {
        "name": "Aggregate",
        "description": "Groups and aggregates records (sum, count, avg, min, max).",
        "category": "Data",
        "inputs":  [{"name": "records", "type": "array"}, {"name": "group_by", "type": "array"}, {"name": "aggregations", "type": "object"}],
        "outputs": [{"name": "result", "type": "array"}],
    },
    {
        "name": "Validate",
        "description": "Validates data against a schema or set of rules.",
        "category": "Data",
        "inputs":  [{"name": "data", "type": "object"}, {"name": "schema", "type": "object"}],
        "outputs": [{"name": "is_valid", "type": "boolean"}, {"name": "errors", "type": "array"}],
    },
    {
        "name": "Deduplicate",
        "description": "Removes duplicate records from a dataset based on a key.",
        "category": "Data",
        "inputs":  [{"name": "records", "type": "array"}, {"name": "key_field", "type": "string"}],
        "outputs": [{"name": "unique_records", "type": "array"}, {"name": "removed_count", "type": "integer"}],
    },

    # ── Control ─────────────────────────────────────────────────────────────
    {
        "name": "If/Else",
        "description": "Branches execution into true or false paths based on a condition.",
        "category": "Control",
        "inputs":  [{"name": "condition", "type": "string"}, {"name": "data", "type": "any"}],
        "outputs": [{"name": "true_branch", "type": "any"}, {"name": "false_branch", "type": "any"}],
    },
    {
        "name": "Switch",
        "description": "Routes execution to one of many branches based on a value.",
        "category": "Control",
        "inputs":  [{"name": "value", "type": "any"}, {"name": "cases", "type": "array"}],
        "outputs": [{"name": "matched_branch", "type": "any"}, {"name": "default_branch", "type": "any"}],
    },
    {
        "name": "ForEach",
        "description": "Iterates over a list and runs downstream nodes for each item.",
        "category": "Control",
        "inputs":  [{"name": "items", "type": "array"}],
        "outputs": [{"name": "current_item", "type": "any"}, {"name": "index", "type": "integer"}, {"name": "results", "type": "array"}],
    },
    {
        "name": "Merge",
        "description": "Waits for multiple upstream branches and merges their outputs.",
        "category": "Control",
        "inputs":  [{"name": "branch_1", "type": "any"}, {"name": "branch_2", "type": "any"}],
        "outputs": [{"name": "merged_data", "type": "array"}],
    },
    {
        "name": "Parallel",
        "description": "Runs multiple downstream branches concurrently.",
        "category": "Control",
        "inputs":  [{"name": "data", "type": "any"}],
        "outputs": [{"name": "branch_output", "type": "any"}],
    },
    {
        "name": "Retry",
        "description": "Retries a node or sub-workflow on failure with backoff.",
        "category": "Control",
        "inputs":  [{"name": "max_attempts", "type": "integer"}, {"name": "backoff_seconds", "type": "integer"}],
        "outputs": [{"name": "success", "type": "boolean"}, {"name": "attempts_used", "type": "integer"}],
    },
    {
        "name": "Delay",
        "description": "Pauses execution for a fixed duration or until a scheduled time.",
        "category": "Control",
        "inputs":  [{"name": "duration_seconds", "type": "integer"}],
        "outputs": [{"name": "resumed_at", "type": "string"}],
    },

    # ── Ops ─────────────────────────────────────────────────────────────────
    {
        "name": "Logger",
        "description": "Logs a message or data object to the workflow run log.",
        "category": "Ops",
        "inputs":  [{"name": "message", "type": "string"}, {"name": "level", "type": "string"}, {"name": "data", "type": "any"}],
        "outputs": [{"name": "log_id", "type": "string"}],
    },
    {
        "name": "Metrics",
        "description": "Emits a metric (counter, gauge, histogram) to a monitoring system.",
        "category": "Ops",
        "inputs":  [{"name": "metric_name", "type": "string"}, {"name": "value", "type": "number"}, {"name": "tags", "type": "object"}],
        "outputs": [{"name": "status", "type": "string"}],
    },
    {
        "name": "Alert",
        "description": "Sends an alert notification via PagerDuty, Slack, or webhook.",
        "category": "Ops",
        "inputs":  [{"name": "channel", "type": "string"}, {"name": "message", "type": "string"}, {"name": "severity", "type": "string"}],
        "outputs": [{"name": "alert_id", "type": "string"}, {"name": "status", "type": "string"}],
    },
    {
        "name": "Audit",
        "description": "Records an immutable audit trail entry for compliance purposes.",
        "category": "Ops",
        "inputs":  [{"name": "action", "type": "string"}, {"name": "actor", "type": "string"}, {"name": "resource", "type": "string"}, {"name": "details", "type": "object"}],
        "outputs": [{"name": "audit_id", "type": "string"}, {"name": "timestamp", "type": "string"}],
    },
    {
        "name": "PII Masker",
        "description": "Detects and masks PII fields (email, SSN, phone, etc.) in data.",
        "category": "Ops",
        "inputs":  [{"name": "data", "type": "object"}, {"name": "fields_to_mask", "type": "array"}],
        "outputs": [{"name": "masked_data", "type": "object"}, {"name": "masked_fields", "type": "array"}],
    },

    # ── Human ────────────────────────────────────────────────────────────────
    {
        "name": "Human Approval",
        "description": "Pauses workflow and waits for a human to approve or reject before continuing.",
        "category": "Human",
        "inputs":  [{"name": "approver_email", "type": "string"}, {"name": "context", "type": "object"}, {"name": "timeout_hours", "type": "integer"}],
        "outputs": [{"name": "decision", "type": "string"}, {"name": "reviewer", "type": "string"}, {"name": "comments", "type": "string"}],
    },
]

# ---------------------------------------------------------------------------
# Connection helper
# ---------------------------------------------------------------------------

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ---------------------------------------------------------------------------
# Init
# ---------------------------------------------------------------------------

def init_db():
    """Create table and insert seed nodes (skips duplicates)."""
    conn = get_connection()
    try:
        conn.execute(CREATE_NODES_TABLE)
        conn.commit()

        for node in SEED_NODES:
            conn.execute(
                """
                INSERT OR IGNORE INTO nodes (name, description, category, inputs, outputs, document_frequency, is_discovered)
                VALUES (?, ?, ?, ?, ?, 0, 0)
                """,
                (
                    node["name"],
                    node["description"],
                    node["category"],
                    json.dumps(node["inputs"]),
                    json.dumps(node["outputs"]),
                ),
            )
        conn.commit()
        print(f"[DB] Initialised. Seed nodes inserted (duplicates skipped).")
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def get_all_nodes() -> List[Dict]:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM nodes ORDER BY category, name").fetchall()
        return [_row_to_dict(r) for r in rows]
    finally:
        conn.close()


def get_node_by_name(name: str) -> Optional[Dict]:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM nodes WHERE name = ?", (name,)).fetchone()
        return _row_to_dict(row) if row else None
    finally:
        conn.close()


def insert_node(name: str, description: str, category: str,
                inputs: List[Dict], outputs: List[Dict]) -> int:
    """Insert a newly discovered node. Returns the new row id."""
    conn = get_connection()
    try:
        cursor = conn.execute(
            """
            INSERT OR IGNORE INTO nodes (name, description, category, inputs, outputs, document_frequency, is_discovered)
            VALUES (?, ?, ?, ?, ?, 1, 1)
            """,
            (name, description, category, json.dumps(inputs), json.dumps(outputs)),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def increment_document_frequency(name: str):
    """Call this each time a node is referenced in a document."""
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE nodes SET document_frequency = document_frequency + 1 WHERE name = ?",
            (name,),
        )
        conn.commit()
    finally:
        conn.close()


def get_nodes_as_catalog_text() -> str:
    """
    Returns a compact text representation of all nodes — used in LLM prompts.
    Format:
        [Category] NodeName — description
          inputs : field(type), ...
          outputs: field(type), ...
    """
    nodes = get_all_nodes()
    lines = []
    current_category = None
    for n in nodes:
        if n["category"] != current_category:
            current_category = n["category"]
            lines.append(f"\n## {current_category}")
        ins  = ", ".join(f"{i['name']}({i['type']})" for i in n["inputs"])
        outs = ", ".join(f"{o['name']}({o['type']})" for o in n["outputs"])
        lines.append(f"  - {n['name']}: {n['description']}")
        lines.append(f"      inputs : {ins or 'none'}")
        lines.append(f"      outputs: {outs or 'none'}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------

def _row_to_dict(row: sqlite3.Row) -> Dict:
    d = dict(row)
    d["inputs"]  = json.loads(d["inputs"]  or "[]")
    d["outputs"] = json.loads(d["outputs"] or "[]")
    d["is_discovered"] = bool(d["is_discovered"])
    return d


# ---------------------------------------------------------------------------
# Entrypoint — run directly to initialise
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    init_db()

    print("\n── All nodes ──────────────────────────────────────────")
    for n in get_all_nodes():
        flag = "[DISCOVERED]" if n["is_discovered"] else "[BASE]"
        print(f"  {flag} [{n['category']}] {n['name']} (freq={n['document_frequency']})")

    print("\n── Catalog text (used in prompts) ─────────────────────")
    print(get_nodes_as_catalog_text())
