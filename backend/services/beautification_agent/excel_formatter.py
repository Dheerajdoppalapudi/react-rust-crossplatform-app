import json
import os
import re

import openpyxl
from openpyxl.styles import (
    Font, PatternFill, Border, Side, Alignment,
)
from openpyxl.utils import column_index_from_string, get_column_letter, range_boundaries
from openpyxl.worksheet.datavalidation import DataValidation

from services.llm_service import default_llm_service
from .constants import THEMES, NUMBER_FORMATS, ALIGNMENTS

# Configuration
MAX_COLS = 100
MAX_FORMAT_ROWS = 10000
ENTERPRISE_FONT = "Calibri"

# Load system prompt from markdown file
_PROMPT_FILE = os.path.join(os.path.dirname(__file__), "excel_enhance_prompt.md")
with open(_PROMPT_FILE) as _f:
    SYSTEM_PROMPT = _f.read()

USER_PROMPT = """\
Workbook structure:

{structure}

Generate the formatting plan."""


# ---------------------------------------------------------------------------
# Sheet inspection helpers
# ---------------------------------------------------------------------------

def _detect_sheet_type(ws) -> str:
    """Classify a worksheet as 'hidden', 'chart', 'sparse', or 'data'."""
    if ws.sheet_state == "hidden":
        return "hidden"
    if ws.max_row is None or ws.max_column is None:
        return "chart"
    non_empty = sum(
        1
        for r in range(1, min(ws.max_row + 1, 21))
        for c in range(1, min(ws.max_column + 1, 21))
        if ws.cell(row=r, column=c).value is not None
    )
    total = min(ws.max_row, 20) * min(ws.max_column, 20)
    if total > 0 and non_empty / total < 0.05:
        return "sparse"
    return "data"


def _read_tab_color(ws) -> str | None:
    """Return existing tab color as a 6-char RRGGBB hex string, or None if unset."""
    tc = ws.sheet_properties.tabColor
    if tc is None:
        return None
    rgb = getattr(tc, "rgb", None)
    if rgb and rgb not in ("00000000", "FF000000"):
        return rgb[-6:]
    return None


# ===================================================================
# STEP 1 — Extract workbook structure (sent to LLM)
# ===================================================================
def extract_structure(filepath: str) -> list[dict]:
    """
    Read the workbook and return per-sheet metadata including a raw
    preview of rows 1-15.  The LLM uses the preview grid to locate
    table regions, detect header rows, and infer column types —
    replacing fragile programmatic heuristics.

    Hidden and chart-only sheets are excluded.
    """
    wb = openpyxl.load_workbook(filepath, data_only=True)
    sheets = []

    for name in wb.sheetnames:
        ws = wb[name]

        sheet_type = _detect_sheet_type(ws)
        existing_tab_color = _read_tab_color(ws)

        if sheet_type in ("hidden", "chart"):
            continue

        if ws.max_row is None or ws.max_column is None or ws.max_row < 1:
            continue

        max_col = min(ws.max_column, MAX_COLS)
        total_rows = ws.max_row

        # Named Excel Tables (explicit ranges defined by the workbook author)
        named_tables = []
        try:
            for tbl in ws.tables.values():
                named_tables.append({"name": tbl.name, "range": tbl.ref})
        except Exception:
            pass

        # Raw preview: rows 1-15, each cell keyed by column letter
        # This lets the LLM see the actual layout and decide where tables live.
        col_letters = [get_column_letter(c) for c in range(1, max_col + 1)]
        preview_rows = []
        for r in range(1, min(total_rows + 1, 16)):
            cells = {}
            for c in range(1, max_col + 1):
                val = ws.cell(row=r, column=c).value
                cells[get_column_letter(c)] = str(val) if val is not None else None
            preview_rows.append({"row": r, "cells": cells})

        sheets.append({
            "sheet_name": name,
            "sheet_type": sheet_type,           # "data" or "sparse"
            "existing_tab_color": existing_tab_color,
            "named_tables": named_tables,
            "total_rows": total_rows,
            "total_columns": max_col,
            "column_letters": col_letters,
            "preview_rows": preview_rows,        # raw rows 1-15 for LLM analysis
        })

    wb.close()
    return sheets


# ===================================================================
# STEP 2 — Rule-based baseline (always applied, LLM overrides on top)
# ===================================================================
def apply_rule_based_defaults(filepath: str, structure: list[dict]) -> openpyxl.Workbook:
    """
    Apply a minimal, safe baseline:
      - Consistent font and thin border on every occupied cell
      - Auto-fit column widths
      - Landscape print / fit-to-page

    Intentionally avoids header detection, auto-filter, and freeze panes —
    those are handled by the LLM step which knows the actual table layout.
    """
    sheet_meta = {s["sheet_name"]: s for s in structure}
    wb = openpyxl.load_workbook(filepath)

    thin_side = Side(style="thin", color="D0D0D0")
    thin_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

    for ws in wb.worksheets:
        meta = sheet_meta.get(ws.title)

        # Skip sheets absent from structure (hidden/chart) and sparse sheets
        if meta is None or meta.get("sheet_type") == "sparse":
            continue

        if ws.max_row is None or ws.max_column is None:
            continue

        max_col = min(ws.max_column, MAX_COLS)
        max_row = min(ws.max_row, MAX_FORMAT_ROWS)

        # Uniform font + border on every cell that has a value
        for r in range(1, max_row + 1):
            for c in range(1, max_col + 1):
                cell = ws.cell(row=r, column=c)
                if cell.value is not None:
                    cell.font = Font(name=ENTERPRISE_FONT, size=10)
                    cell.border = thin_border
                    cell.alignment = Alignment(vertical="center")

        # Auto-fit column widths (sample first 500 rows)
        for c in range(1, max_col + 1):
            max_len = 0
            for r in range(1, min(max_row + 1, 502)):
                max_len = max(max_len, len(str(ws.cell(row=r, column=c).value or "")))
            if max_len > 0:
                ws.column_dimensions[get_column_letter(c)].width = max_len + 2

        # Print settings
        ws.sheet_properties.pageSetUpPr = openpyxl.worksheet.properties.PageSetupProperties(fitToPage=True)
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
        ws.page_setup.orientation = "landscape"

    return wb


# ===================================================================
# STEP 3 — LLM one-shot formatting plan
# ===================================================================
def get_llm_formatting_plan(structure: list[dict]) -> dict | None:
    """Send structure (including raw preview rows) to LLM, get back a formatting plan."""
    system_prompt = SYSTEM_PROMPT.format(
        themes=", ".join(THEMES.keys()),
        formats=json.dumps(list(NUMBER_FORMATS.keys())),
        alignments=json.dumps(ALIGNMENTS),
    )
    user_prompt = USER_PROMPT.format(structure=json.dumps(structure, indent=2))

    text = default_llm_service.make_system_user_request(system_prompt, user_prompt)
    if text is None:
        return None

    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


# ===================================================================
# STEP 4 — Apply LLM plan per table region
# ===================================================================
def apply_llm_formatting(wb: openpyxl.Workbook, plan: dict) -> openpyxl.Workbook:
    """
    Apply the LLM's formatting plan.  Each sheet may contain multiple
    independent tables; formatting (header fill, alternating rows, number
    formats) is applied per table range so side-by-side tables don't bleed
    into each other.

    Freeze panes and auto-filter are applied once per sheet using the
    first (primary) table's location.
    """
    for sheet_plan in plan.get("sheets", []):
        sheet_name = sheet_plan.get("sheet_name")
        if sheet_name not in wb.sheetnames:
            continue
        if sheet_plan.get("skip"):
            continue

        ws = wb[sheet_name]
        theme_name = sheet_plan.get("theme", "corporate_blue")
        theme = THEMES.get(theme_name, THEMES["corporate_blue"])

        # Tab color
        if sheet_plan.get("tab_color_action", "override") == "override":
            ws.sheet_properties.tabColor = theme["tab_color"]

        primary_table_done = False  # freeze + auto-filter set once for the sheet

        for table_plan in sheet_plan.get("tables", []):
            header_range = table_plan.get("header_range", "")
            if not header_range:
                continue

            # Parse the header range to get row + column boundaries
            try:
                col_start, header_row, col_end, _ = range_boundaries(header_range)
            except Exception:
                continue

            col_end = min(col_end, MAX_COLS)
            data_start_row = table_plan.get("data_start_row", header_row + 1)
            table_max_row = min(ws.max_row or 1, MAX_FORMAT_ROWS)

            # ---- Header row styling ----
            header_fill = PatternFill(
                start_color=theme["header_fill"],
                end_color=theme["header_fill"],
                fill_type="solid",
            )
            header_font = Font(
                name=ENTERPRISE_FONT, bold=True, size=11, color=theme["header_font"],
            )
            header_border = Border(
                left=Side(style="thin", color=theme["border_dark"]),
                right=Side(style="thin", color=theme["border_dark"]),
                top=Side(style="thin", color=theme["border_dark"]),
                bottom=Side(style="medium", color=theme["border_dark"]),
            )

            for c in range(col_start, col_end + 1):
                cell = ws.cell(row=header_row, column=c)
                cell.fill = header_fill
                cell.font = header_font
                cell.border = header_border
                cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            ws.row_dimensions[header_row].height = 30

            # ---- Alternate row coloring (data rows only, within this table's columns) ----
            if table_plan.get("alternate_row_coloring", True) and table_max_row > data_start_row:
                alt_fill = PatternFill(
                    start_color=theme["accent_light"],
                    end_color=theme["accent_light"],
                    fill_type="solid",
                )
                data_border = Border(
                    left=Side(style="thin", color=theme["border_light"]),
                    right=Side(style="thin", color=theme["border_light"]),
                    top=Side(style="thin", color=theme["border_light"]),
                    bottom=Side(style="thin", color=theme["border_light"]),
                )
                for r in range(data_start_row, table_max_row + 1):
                    for c in range(col_start, col_end + 1):
                        cell = ws.cell(row=r, column=c)
                        cell.border = data_border
                        if r % 2 == 0:
                            cell.fill = alt_fill

            # ---- Per-column number format + alignment ----
            for col_plan in table_plan.get("columns", []):
                col_letter = col_plan.get("col", "")
                if not col_letter:
                    continue
                try:
                    col_idx = column_index_from_string(col_letter)
                except Exception:
                    continue
                if not (col_start <= col_idx <= col_end):
                    continue

                fmt_str = NUMBER_FORMATS.get(col_plan.get("number_format", "general"), "General")
                align_key = col_plan.get("alignment", "left")
                if align_key not in ALIGNMENTS:
                    align_key = "left"

                for r in range(data_start_row, table_max_row + 1):
                    cell = ws.cell(row=r, column=col_idx)
                    cell.number_format = fmt_str
                    cell.alignment = Alignment(horizontal=align_key, vertical="center")

            # ---- Totals row highlight (last row of this table's column range) ----
            if table_plan.get("highlight_totals_row") and table_max_row > data_start_row:
                total_fill = PatternFill(
                    start_color=theme["total_fill"],
                    end_color=theme["total_fill"],
                    fill_type="solid",
                )
                total_font = Font(
                    name=ENTERPRISE_FONT, bold=True, size=10, color=theme["total_font"],
                )
                total_border = Border(
                    top=Side(style="double", color=theme["border_dark"]),
                    bottom=Side(style="thin", color=theme["border_dark"]),
                    left=Side(style="thin", color=theme["border_light"]),
                    right=Side(style="thin", color=theme["border_light"]),
                )
                last_row = ws.max_row
                for c in range(col_start, col_end + 1):
                    cell = ws.cell(row=last_row, column=c)
                    cell.fill = total_fill
                    cell.font = total_font
                    cell.border = total_border

            # ---- Freeze panes + auto-filter scoped to the primary table only ----
            # Excel supports only one auto-filter per sheet; use the first table.
            if not primary_table_done:
                ws.freeze_panes = f"A{data_start_row}"
                first_col_ltr = get_column_letter(col_start)
                last_col_ltr = get_column_letter(col_end)
                ws.auto_filter.ref = (
                    f"{first_col_ltr}{header_row}:{last_col_ltr}{ws.max_row}"
                )
                ws.print_title_rows = f"{header_row}:{header_row}"
                primary_table_done = True

    return wb


# ===================================================================
# MAIN ENTRY POINT
# ===================================================================
def format_excel(input_path: str, output_path: str) -> dict:
    """
    Full pipeline:
      1. Extract structure (with raw rows 1-15 preview per sheet)
      2. Apply rule-based baseline (font/border/autofit)
      3. LLM identifies table regions and produces a formatting plan
      4. Apply LLM plan per table region
      5. Save

    Returns a status dict with metadata about what was done.
    """
    structure = extract_structure(input_path)
    wb = apply_rule_based_defaults(input_path, structure)

    llm_applied = False
    llm_theme = None
    try:
        plan = get_llm_formatting_plan(structure)
        if plan:
            wb = apply_llm_formatting(wb, plan)
            llm_applied = True
            sheets_in_plan = plan.get("sheets", [])
            if sheets_in_plan:
                llm_theme = sheets_in_plan[0].get("theme")
    except Exception as e:
        print(f"[excel_formatter] LLM enhancement failed, using rule-based only: {e}")

    wb.save(output_path)
    wb.close()

    return {
        "sheets_processed": len(structure),
        "total_rows": sum(s.get("total_rows", 0) for s in structure),
        "llm_enhanced": llm_applied,
        "theme_applied": llm_theme,
    }
