#!/usr/bin/env python3
"""Convert AUDITOR_BUNDLE_GPT6.md to a human-readable PDF."""
import os
import re
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Preformatted,
)
from reportlab.lib.enums import TA_LEFT

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
md_path = os.path.join(ROOT, "AUDITOR_BUNDLE_GPT6.md")
pdf_path = os.path.join(ROOT, "AUDITOR_BUNDLE_GPT6.pdf")

with open(md_path, "r", encoding="utf-8") as f:
    md = f.read()

# Skip the git appendices — not interesting on paper
if "# Appendix A:" in md:
    md = md.split("# Appendix A:")[0].rstrip() + "\n"

styles = getSampleStyleSheet()
H1 = ParagraphStyle(
    "H1", parent=styles["Heading1"], fontSize=20, leading=24,
    spaceBefore=12, spaceAfter=8, textColor=HexColor("#0B1B3B"),
)
H2 = ParagraphStyle(
    "H2", parent=styles["Heading2"], fontSize=15, leading=18,
    spaceBefore=10, spaceAfter=6, textColor=HexColor("#0B1B3B"),
)
H3 = ParagraphStyle(
    "H3", parent=styles["Heading3"], fontSize=12, leading=15,
    spaceBefore=8, spaceAfter=4, textColor=HexColor("#1d61e7"),
)
PROSE = ParagraphStyle(
    "Prose", parent=styles["BodyText"], fontSize=9, leading=12,
    spaceAfter=4, alignment=TA_LEFT,
)
BULLET = ParagraphStyle("Bullet", parent=PROSE, leftIndent=14, bulletIndent=2)
CODE = ParagraphStyle(
    "Code", parent=styles["Code"], fontSize=7.5, leading=9.5,
    fontName="Courier", textColor=HexColor("#111827"),
    leftIndent=0, rightIndent=0, spaceAfter=2,
)


def self_escape(s: str) -> str:
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"__(.+?)__", r"<b>\1</b>", s)
    s = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', s)
    return s


def md_to_flowables(text: str):
    out = []
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith("```"):
            i += 1
            block_lines = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                block_lines.append(lines[i])
                i += 1
            i += 1
            block_text = "\n".join(block_lines)
            if len(block_lines) > 80:
                head = "\n".join(block_lines[:60])
                tail = "\n".join(block_lines[-20:])
                block_text = head + f"\n... ({len(block_lines) - 80} lines truncated) ...\n" + tail
            try:
                out.append(Preformatted(block_text, CODE, maxLineLength=220))
            except Exception:
                out.append(Preformatted(block_text[:5000], CODE, maxLineLength=220))
            out.append(Spacer(1, 4))
            continue

        if stripped == "---":
            out.append(Spacer(1, 6))
            i += 1
            continue

        if stripped.startswith("### "):
            out.append(Paragraph(self_escape(stripped[4:]), H3))
            i += 1
            continue
        if stripped.startswith("## "):
            out.append(Paragraph(self_escape(stripped[3:]), H2))
            i += 1
            continue
        if stripped.startswith("# "):
            out.append(Paragraph(self_escape(stripped[2:]), H1))
            i += 1
            continue

        if stripped.startswith("- ") or stripped.startswith("* "):
            out.append(Paragraph("• " + self_escape(stripped[2:]), BULLET))
            i += 1
            continue
        if len(stripped) > 2 and stripped[0].isdigit() and stripped[1:3] in (". ", ") "):
            out.append(Paragraph(self_escape(stripped[3:]), BULLET))
            i += 1
            continue

        if not stripped:
            i += 1
            continue

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
            paragraph_text = " ".join(line.strip() for line in block if line.strip())
            paragraph_text = self_escape(paragraph_text)
            try:
                out.append(Paragraph(paragraph_text, PROSE))
            except Exception:
                out.append(Preformatted(paragraph_text[:2000], CODE))
            out.append(Spacer(1, 2))
    return out


flow = md_to_flowables(md)
print(f"Flowable count: {len(flow)}")
print(f"Estimated pages: ~{len(flow) // 50}")

doc = SimpleDocTemplate(
    pdf_path,
    pagesize=LETTER,
    leftMargin=0.6 * inch,
    rightMargin=0.6 * inch,
    topMargin=0.6 * inch,
    bottomMargin=0.6 * inch,
    title="uniOS — Auditor Bundle for GPT-6 Astra",
    author="Hermes (auditor prep)",
)


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(HexColor("#6B7280"))
    canvas.drawRightString(LETTER[0] - 0.6 * inch, 0.3 * inch, f"Page {doc.page}")
    canvas.drawString(0.6 * inch, 0.3 * inch, "uniOS Auditor Bundle (Hermes prep)")
    canvas.restoreState()


doc.build(flow, onFirstPage=on_page, onLaterPages=on_page)
print(f"Wrote: {pdf_path} ({os.path.getsize(pdf_path)} bytes = {os.path.getsize(pdf_path) // 1024} KB)")
