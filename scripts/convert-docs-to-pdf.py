#!/usr/bin/env python3
"""
VocalIA - Convert Markdown Documents to PDF
Session 250.53 - 02/02/2026
Simplified version for robust conversion
"""

import os
import re
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Preformatted
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER

# Output directory
OUTPUT_DIR = "/Users/mac/Desktop"

# Documents to convert
DOCS = [
    {
        "path": "/Users/mac/Desktop/VocalIA/docs/ARCHITECTURE-SYSTEM-FORENSIC-AUDIT.md",
        "output": "VocalIA-Architecture-System-Forensic-Audit.pdf"
    },
    {
        "path": "/Users/mac/Desktop/VocalIA/docs/PLUG-AND-PLAY-STRATEGY.md",
        "output": "VocalIA-Plug-And-Play-Strategy.pdf"
    },
    {
        "path": "/Users/mac/Desktop/VocalIA/docs/VOCALIA-MCP.md",
        "output": "VocalIA-MCP-Server-Documentation.pdf"
    },
    {
        "path": "/Users/mac/Desktop/VocalIA/docs/FORENSIC-AUDIT-WEBSITE.md",
        "output": "VocalIA-Forensic-Audit-Website.pdf"
    },
    {
        "path": "/Users/mac/Desktop/VocalIA/docs/VOCALIA-SYSTEM-ARCHITECTURE.md",
        "output": "VocalIA-System-Architecture.pdf"
    }
]


def create_styles():
    """Create custom styles for PDF"""
    styles = getSampleStyleSheet()

    # Title style
    styles.add(ParagraphStyle(
        name='DocTitle',
        parent=styles['Heading1'],
        fontSize=24,
        spaceAfter=30,
        textColor=colors.HexColor('#5E6AD2'),
        alignment=TA_CENTER
    ))

    # H1 style
    styles.add(ParagraphStyle(
        name='H1',
        parent=styles['Heading1'],
        fontSize=18,
        spaceBefore=20,
        spaceAfter=12,
        textColor=colors.HexColor('#1e293b')
    ))

    # H2 style
    styles.add(ParagraphStyle(
        name='H2',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=16,
        spaceAfter=10,
        textColor=colors.HexColor('#334155')
    ))

    # H3 style
    styles.add(ParagraphStyle(
        name='H3',
        parent=styles['Heading3'],
        fontSize=12,
        spaceBefore=12,
        spaceAfter=8,
        textColor=colors.HexColor('#475569')
    ))

    # Modify existing BodyText style
    styles['BodyText'].fontSize = 10
    styles['BodyText'].spaceBefore = 6
    styles['BodyText'].spaceAfter = 6
    styles['BodyText'].leading = 14

    # Code style
    styles.add(ParagraphStyle(
        name='CodeBlock',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        spaceBefore=4,
        spaceAfter=4,
        backColor=colors.HexColor('#f1f5f9'),
        leftIndent=10,
        rightIndent=10
    ))

    # Blockquote style
    styles.add(ParagraphStyle(
        name='BlockQuote',
        parent=styles['Normal'],
        fontSize=10,
        leftIndent=20,
        spaceBefore=8,
        spaceAfter=8,
        textColor=colors.HexColor('#64748b'),
    ))

    return styles


def escape_xml(text):
    """Escape XML special characters"""
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    return text


def clean_text(text):
    """Clean text for PDF - strip all markdown/html formatting"""
    # Remove markdown formatting completely
    text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)  # Bold
    text = re.sub(r'\*([^*]+)\*', r'\1', text)      # Italic
    text = re.sub(r'`([^`]+)`', r'\1', text)        # Inline code
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)  # Links

    # Remove HTML completely
    text = re.sub(r'<[^>]+>', '', text)

    # Clean special characters
    text = text.replace('→', '->')
    text = text.replace('✅', '[OK]')
    text = text.replace('❌', '[X]')
    text = text.replace('⚠️', '[!]')
    text = text.replace('🔧', '[FIX]')
    text = text.replace('🎨', '[DESIGN]')
    text = text.replace('🔍', '[SEARCH]')
    text = text.replace('🚀', '[LAUNCH]')
    text = text.replace('🌍', '[GLOBAL]')
    text = text.replace('🔐', '[SECURE]')
    text = text.replace('🟢', '[OK]')
    text = text.replace('🟡', '[!]')
    text = text.replace('🚨', '[!!]')
    text = text.replace('│', '|')
    text = text.replace('├', '|')
    text = text.replace('└', '|')
    text = text.replace('┌', '+')
    text = text.replace('┐', '+')
    text = text.replace('─', '-')
    text = text.replace('┘', '+')
    text = text.replace('┬', '+')
    text = text.replace('┴', '+')
    text = text.replace('┼', '+')
    text = text.replace('▼', 'v')
    text = text.replace('▲', '^')
    text = text.replace('◄', '<')
    text = text.replace('►', '>')
    text = text.replace('↓', 'v')
    text = text.replace('↑', '^')

    return escape_xml(text.strip())


def parse_markdown(content, styles):
    """Parse markdown and return PDF elements"""
    elements = []
    lines = content.split('\n')

    in_code_block = False
    code_block_content = []
    in_table = False
    table_rows = []

    i = 0
    while i < len(lines):
        line = lines[i]

        # Code blocks
        if line.startswith('```'):
            if in_code_block:
                # End code block
                code_text = '\n'.join(code_block_content)
                if code_text.strip():
                    # Use Preformatted for code
                    elements.append(Preformatted(code_text, styles['CodeBlock']))
                code_block_content = []
                in_code_block = False
            else:
                in_code_block = True
            i += 1
            continue

        if in_code_block:
            code_block_content.append(line)
            i += 1
            continue

        # Tables
        if '|' in line and not line.startswith('```'):
            # Check if it's a table separator
            if re.match(r'^[\s|:-]+$', line):
                i += 1
                continue

            # Parse table row
            cells = [clean_text(cell.strip()) for cell in line.split('|')[1:-1]]
            if cells:
                if not in_table:
                    in_table = True
                    table_rows = []
                table_rows.append(cells)
            i += 1
            continue
        elif in_table:
            # End table
            if table_rows:
                try:
                    # Ensure all rows have same number of columns
                    max_cols = max(len(row) for row in table_rows)
                    normalized_rows = []
                    for row in table_rows:
                        while len(row) < max_cols:
                            row.append('')
                        normalized_rows.append(row)

                    table = Table(normalized_rows)
                    table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#5E6AD2')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, -1), 8),
                        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                        ('TOPPADDING', (0, 0), (-1, 0), 8),
                        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ]))
                    elements.append(table)
                    elements.append(Spacer(1, 12))
                except Exception as e:
                    print(f"    Warning: Table parsing failed: {e}")
            in_table = False
            table_rows = []
            # Don't increment i, process this line normally

        # Headers
        if line.startswith('# '):
            text = clean_text(line[2:])
            if text:
                elements.append(Paragraph(text, styles['DocTitle']))
        elif line.startswith('## '):
            text = clean_text(line[3:])
            if text:
                elements.append(Paragraph(text, styles['H1']))
        elif line.startswith('### '):
            text = clean_text(line[4:])
            if text:
                elements.append(Paragraph(text, styles['H2']))
        elif line.startswith('#### '):
            text = clean_text(line[5:])
            if text:
                elements.append(Paragraph(text, styles['H3']))

        # Blockquotes
        elif line.startswith('> '):
            text = clean_text(line[2:])
            if text:
                elements.append(Paragraph(text, styles['BlockQuote']))

        # Horizontal rules
        elif line.startswith('---'):
            elements.append(Spacer(1, 12))

        # List items
        elif line.strip().startswith('- ') or line.strip().startswith('* '):
            text = clean_text(line.strip()[2:])
            if text:
                elements.append(Paragraph(f"• {text}", styles['BodyText']))

        elif re.match(r'^\d+\.\s', line.strip()):
            text = clean_text(re.sub(r'^\d+\.\s', '', line.strip()))
            if text:
                elements.append(Paragraph(f"  {text}", styles['BodyText']))

        # Regular paragraphs
        elif line.strip():
            text = clean_text(line)
            if text:
                try:
                    elements.append(Paragraph(text, styles['BodyText']))
                except Exception as e:
                    # If paragraph fails, try as preformatted
                    elements.append(Preformatted(text, styles['BodyText']))

        # Empty lines
        else:
            elements.append(Spacer(1, 6))

        i += 1

    # Handle any remaining table
    if in_table and table_rows:
        try:
            max_cols = max(len(row) for row in table_rows)
            normalized_rows = []
            for row in table_rows:
                while len(row) < max_cols:
                    row.append('')
                normalized_rows.append(row)

            table = Table(normalized_rows)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#5E6AD2')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ]))
            elements.append(table)
        except:
            pass

    return elements


def add_header_footer(canvas, doc, title):
    """Add header and footer to each page"""
    canvas.saveState()

    # Header
    canvas.setFont('Helvetica-Bold', 10)
    canvas.setFillColor(colors.HexColor('#5E6AD2'))
    canvas.drawString(2*cm, A4[1] - 1.5*cm, "VocalIA")

    canvas.setFont('Helvetica', 9)
    canvas.setFillColor(colors.HexColor('#64748b'))
    short_title = title[:50] + "..." if len(title) > 50 else title
    canvas.drawRightString(A4[0] - 2*cm, A4[1] - 1.5*cm, short_title)

    # Footer
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(colors.HexColor('#94a3b8'))
    canvas.drawString(2*cm, 1.5*cm, f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    canvas.drawRightString(A4[0] - 2*cm, 1.5*cm, f"Page {doc.page}")

    canvas.restoreState()


def convert_md_to_pdf(md_path, pdf_path, styles):
    """Convert a single markdown file to PDF"""
    print(f"  Converting: {os.path.basename(md_path)}")

    # Read markdown content
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract title from first line
    first_line = content.split('\n')[0]
    title = first_line.replace('#', '').strip() if first_line.startswith('#') else os.path.basename(md_path)

    # Create PDF document
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2.5*cm,
        bottomMargin=2.5*cm
    )

    # Parse markdown to PDF elements
    elements = parse_markdown(content, styles)

    # Build PDF with header/footer
    doc.build(
        elements,
        onFirstPage=lambda c, d: add_header_footer(c, d, title),
        onLaterPages=lambda c, d: add_header_footer(c, d, title)
    )

    print(f"    -> {pdf_path}")


def main():
    """Main function"""
    print("\n" + "="*60)
    print("VocalIA - Markdown to PDF Converter")
    print("="*60 + "\n")

    # Create styles
    styles = create_styles()

    success_count = 0
    for doc in DOCS:
        pdf_path = os.path.join(OUTPUT_DIR, doc["output"])
        try:
            convert_md_to_pdf(doc["path"], pdf_path, styles)
            success_count += 1
        except Exception as e:
            print(f"    ERROR: {e}")

    print("\n" + "="*60)
    print(f"[OK] {success_count}/{len(DOCS)} documents converted successfully!")
    print(f"Output directory: {OUTPUT_DIR}")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
