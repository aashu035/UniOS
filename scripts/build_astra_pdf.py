#!/usr/bin/env python3
"""
Build a PDF-native auditor bundle for Astra.

Unlike build_auditor_pdf.py (which is markdown -> PDF), this script
builds the PDF directly: each file becomes a section with a clear
file-path header, code rendered as monospace blocks with language
hints, tables as proper tables, and planned page breaks.
"""
import os
import re
import textwrap

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Preformatted, Table, TableStyle,
    KeepTogether, PageBreak,
)
from reportlab.lib.enums import TA_LEFT

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Read source
brief_path = os.path.join(ROOT, "AUDITOR_BRIEF.md")
bundle_path = os.path.join(ROOT, "AUDITOR_BUNDLE_GPT6.md")
out_path = os.path.join(ROOT, "AUDIT_PDF_FOR_ASTRA.pdf")

with open(brief_path, "r", encoding="utf-8") as f:
    brief = f.read()
with open(bundle_path, "r", encoding="utf-8") as f:
    bundle = f.read()

# Skip the appendix in the bundle (git history is recoverable from the repo)
if "# Appendix A:" in bundle:
    bundle = bundle.split("# Appendix A:")[0].rstrip() + "\n"

# Styles
styles = getSampleStyleSheet()
NAVY = HexColor("#0B1B3B")
PRIMARY = HexColor("#1d61e7")
DANGER = HexColor("#DC2626")
WARN = HexColor("#f59e0b")
MUTED = HexColor("#6B7280")
BORDER = HexColor("#E5E7EB")
CODE_BG = HexColor("#F8F9FA")

Title = ParagraphStyle(
    "Title", parent=styles["Title"], fontSize=24, leading=28,
    textColor=NAVY, spaceAfter=12, alignment=TA_LEFT,
)
H1 = ParagraphStyle(
    "H1", parent=styles["Heading1"], fontSize=18, leading=22,
    spaceBefore=18, spaceAfter=8, textColor=NAVY, keepWithNext=True,
)
H2 = ParagraphStyle(
    "H2", parent=styles["Heading2"], fontSize=14, leading=18,
    spaceBefore=12, spaceAfter=6, textColor=NAVY, keepWithNext=True,
)
H3 = ParagraphStyle(
    "H3", parent=styles["Heading3"], fontSize=11.5, leading=15,
    spaceBefore=8, spaceAfter=4, textColor=PRIMARY, keepWithNext=True,
)
Prose = ParagraphStyle(
    "Prose", parent=styles["BodyText"], fontSize=9.5, leading=13,
    spaceAfter=5, alignment=TA_LEFT,
)
Bullet = ParagraphStyle(
    "Bullet", parent=Prose, leftIndent=14, bulletIndent=2, spaceAfter=2,
)
Caption = ParagraphStyle(
    "Caption", parent=Prose, fontSize=8, leading=10, textColor=MUTED,
    spaceAfter=4, alignment=TA_LEFT,
)
FilePath = ParagraphStyle(
    "FilePath", parent=Prose, fontSize=10, leading=12,
    fontName="Courier-Bold", textColor=PRIMARY, spaceAfter=4,
)
Code = ParagraphStyle(
    "Code", parent=styles["Code"], fontSize=7.5, leading=9.5,
    fontName="Courier", textColor=HexColor("#111827"),
    spaceAfter=2,
)


def esc(s):
    if not s:
        return ""
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def fmt_inline(s):
    s = esc(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"__(.+?)__", r"<b>\1</b>", s)
    s = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', s)
    return s


def detect_lang(path):
    """Heuristic: pick a label for the code block header."""
    if path.endswith(".ts") or path.endswith(".tsx"):
        return "typescript"
    if path.endswith(".js") or path.endswith(".jsx"):
        return "javascript"
    if path.endswith(".sql"):
        return "sql"
    if path.endswith(".json"):
        return "json"
    if path.endswith(".md"):
        return "markdown"
    if path.endswith(".css"):
        return "css"
    return "text"


def add_code_block(flow, code, lang="text", file_path=None, max_lines=200):
    """Add a code block to the flow with a small caption."""
    lines = code.split("\n")
    truncated = False
    if len(lines) > max_lines:
        truncated = True
        head = "\n".join(lines[: max_lines - 20])
        tail = "\n".join(lines[-20:])
        omitted = len(lines) - max_lines
        code = head + f"\n\n... ({omitted} lines omitted — read the file directly for full content) ...\n\n" + tail
    cap = ""
    if file_path:
        cap = f"{file_path}  ·  {lang}"
        if truncated:
            cap += "  ·  truncated"
        flow.append(Paragraph(esc(cap), Caption))
    try:
        flow.append(Preformatted(code, Code, maxLineLength=240))
    except Exception:
        flow.append(Preformatted(code[:30000], Code, maxLineLength=240))
    flow.append(Spacer(1, 6))


def add_file_section(flow, file_path, content):
    """Render one file as a section: path header + code block."""
    # Don't break the file header from the file content visually
    flow.append(Paragraph(esc(file_path), FilePath))
    lang = detect_lang(file_path)
    # Cap massive files to keep the PDF under control
    max_lines = 300 if file_path.endswith("seed.ts") else 200
    add_code_block(flow, content, lang=lang, file_path=file_path, max_lines=max_lines)
    flow.append(Spacer(1, 10))


def render_markdown_section(flow, md_text):
    """Light markdown render: only headings, lists, paragraphs.
    Code blocks are rendered as monospace Preformatted."""
    lines = md_text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith("```"):
            # code block
            i += 1
            block_lines = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                block_lines.append(lines[i])
                i += 1
            i += 1  # skip closing
            code = "\n".join(block_lines)
            add_code_block(flow, code)
            continue

        if stripped == "---":
            flow.append(Spacer(1, 6))
            i += 1
            continue

        if stripped.startswith("### "):
            flow.append(Paragraph(fmt_inline(stripped[4:]), H3))
            i += 1
            continue
        if stripped.startswith("## "):
            flow.append(Paragraph(fmt_inline(stripped[3:]), H2))
            i += 1
            continue
        if stripped.startswith("# "):
            flow.append(Paragraph(fmt_inline(stripped[2:]), H1))
            i += 1
            continue

        if stripped.startswith("- ") or stripped.startswith("* "):
            flow.append(Paragraph("• " + fmt_inline(stripped[2:]), Bullet))
            i += 1
            continue
        if len(stripped) > 2 and stripped[0].isdigit() and stripped[1:3] in (". ", ") "):
            flow.append(Paragraph(fmt_inline(stripped[3:]), Bullet))
            i += 1
            continue

        if not stripped:
            i += 1
            continue

        # prose block
        block = []
        while i < len(lines):
            l = lines[i]
            s = l.strip()
            if (
                not s
                or s.startswith(("#", "```", "- ", "* "))
                or (len(s) > 2 and s[0].isdigit() and s[1:3] in (". ", ") "))
                or s == "---"
            ):
                break
            block.append(l)
            i += 1
        if block:
            text = " ".join(line.strip() for line in block if line.strip())
            try:
                flow.append(Paragraph(fmt_inline(text), Prose))
            except Exception:
                flow.append(Preformatted(text[:2000], Code))


# ── Build the flow ──
flow = []

# Cover page
flow.append(Spacer(1, 1.2 * inch))
flow.append(Paragraph("uniOS — Auditor Bundle", Title))
flow.append(Paragraph("For independent review by GPT-6 Astra", Prose))
flow.append(Spacer(1, 0.3 * inch))
flow.append(Paragraph("Prepared by Hermes · " + str(__import__("datetime").date.today()), Caption))
flow.append(Spacer(1, 0.5 * inch))
flow.append(Paragraph(
    "This document contains:",
    Prose,
))
flow.append(Paragraph("• Part I — The auditor brief (what to look for, severity model, evidence standard)", Bullet))
flow.append(Paragraph("• Part II — The actual codebase: 73 files, organized by layer", Bullet))
flow.append(Paragraph("• Part III — Index of files for quick navigation", Bullet))
flow.append(Spacer(1, 0.2 * inch))
flow.append(Paragraph(
    "Read Part I first, then Part II section by section. The brief tells you what evidence to look for; the code is the evidence.",
    Prose,
))
flow.append(PageBreak())

# ── Part I: The auditor brief ──
flow.append(Paragraph("Part I — Auditor Brief", H1))
flow.append(Spacer(1, 6))
render_markdown_section(flow, brief)
flow.append(PageBreak())

# ── Part II: The bundle (each file as a section) ──
flow.append(Paragraph("Part II — Actual Codebase", H1))
flow.append(Spacer(1, 6))
flow.append(Paragraph(
    "73 files, ~100K tokens, organized in the order an auditor would scan them: "
    "project shape → routes → data layer → tokens → tests. "
    "Read end to end for full lineage, or jump to the index in Part III.",
    Prose,
))
flow.append(Spacer(1, 12))

# Parse the bundle into (file_path, content) pairs
# Bundle format: each file is preceded by "FILE: <path>" and surrounded by 80-char "=" lines
file_pattern = re.compile(r"={80}\nFILE: (.+?)\n={80}\n(.*?)(?=\n={80}\nFILE: |\Z)", re.DOTALL)
files = file_pattern.findall(bundle)
print(f"Parsed {len(files)} files from bundle")

# Render each file. Group by directory for context.
last_dir = None
for fpath, content in files:
    # Only update the file section; we trust the path order in the bundle
    add_file_section(flow, fpath, content)
    # Page break before each new top-level directory to give the auditor
    # a clean visual break. (We add it inside the section so the first
    # file in a new dir gets the page break for context.)
    this_dir = os.path.dirname(fpath)
    if last_dir is not None and os.path.dirname(this_dir) != os.path.dirname(last_dir):
        # Mild heuristic: page break when jumping across top-level layers
        if "/" in fpath and "/" in last_dir and fpath.split("/")[0] != last_dir.split("/")[0]:
            flow.append(PageBreak())
    last_dir = fpath

# ── Part III: Index ──
flow.append(PageBreak())
flow.append(Paragraph("Part III — File Index", H1))
flow.append(Spacer(1, 6))
flow.append(Paragraph(
    "The {n} files in this bundle, organized by layer.".format(n=len(files)),
    Prose,
))
flow.append(Spacer(1, 8))

# Build a small table of files grouped by top-level directory
groups = {}
for fpath, _ in files:
    top = fpath.split("/")[0] if "/" in fpath else "(root)"
    groups.setdefault(top, []).append(fpath)

tbl_data = [["Layer / file"]]
for top in sorted(groups):
    tbl_data.append([f"[{top}]"])
    for fpath in groups[top]:
        tbl_data.append([f"    {fpath}"])

# Use a single column table to keep it simple and monospace-ish
tbl = Table(tbl_data, colWidths=[6.5 * inch])
tbl.setStyle(TableStyle([
    ("FONT", (0, 0), (-1, -1), "Courier", 8),
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("TEXTCOLOR", (0, 0), (-1, 0), white),
    ("FONT", (0, 0), (-1, 0), "Courier-Bold", 8),
    ("BACKGROUND", (0, 1), (-1, 1), HexColor("#EEF2FF")),
    ("FONT", (0, 1), (-1, 1), "Courier-Bold", 8.5),
    ("ROWBACKGROUNDS", (0, 2), (-1, -1), [white, HexColor("#FAFAFA")]),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TOPPADDING", (0, 0), (-1, -1), 2),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
    ("INNERGRID", (0, 0), (-1, -1), 0.25, BORDER),
]))
flow.append(tbl)

# Build the doc
doc = SimpleDocTemplate(
    out_path,
    pagesize=LETTER,
    leftMargin=0.6 * inch,
    rightMargin=0.6 * inch,
    topMargin=0.6 * inch,
    bottomMargin=0.6 * inch,
    title="uniOS — Auditor Bundle (PDF for Astra)",
    author="Hermes",
)


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(LETTER[0] - 0.6 * inch, 0.3 * inch, f"Page {doc.page}")
    canvas.drawString(0.6 * inch, 0.3 * inch, "uniOS Auditor Bundle (Hermes prep) · PDF for Astra")
    canvas.restoreState()


doc.build(flow, onFirstPage=on_page, onLaterPages=on_page)
print(f"Wrote: {out_path}")
print(f"Size: {os.path.getsize(out_path)} bytes = {os.path.getsize(out_path) // 1024} KB")
