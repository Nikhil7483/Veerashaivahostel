# -*- coding: utf-8 -*-
"""
Daily Warden Report PDF Generator for Lingayath Bhavan Boys Hostel.
Generates a comprehensive A4 Landscape PDF covering all daily warden activities
organized by task sections: Attendance, Cleaning, Leaves, Food, Complaints,
Maintenance, Visitors, Announcements, and Audit Trail.
"""

import io
from datetime import datetime
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
EM_DASH = "\u2014"


# ──────────────────────────────────────────────
# Numbered Canvas (page numbers + footer)
# ──────────────────────────────────────────────

class NumberedCanvas(canvas.Canvas):
    """Custom canvas that adds running page numbers and hostel stamp to the footer."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748b"))
        left_text = "Veerashaiva Lingayath Boys Hostel \u2022 Daily Warden Report \u2022 Confidential"
        self.drawString(25, 18, left_text)
        right_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(841.89 - 25, 18, right_text)
        self.restoreState()


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _fmt_date(date_str: str) -> str:
    """Converts 'YYYY-MM-DD' into 'dd/mm/yyyy'."""
    if not date_str:
        return ""
    try:
        parts = date_str.split("-")
        if len(parts) == 3:
            return f"{parts[2].zfill(2)}/{parts[1].zfill(2)}/{parts[0]}"
    except Exception:
        pass
    return str(date_str)


def _fmt_datetime(dt) -> str:
    """Formats datetime to readable string."""
    if isinstance(dt, datetime):
        return dt.strftime("%d/%m/%Y %I:%M %p")
    if isinstance(dt, str):
        return dt
    return str(dt) if dt else "\u2014"


def _status_color(status: str) -> str:
    """Returns hex color for a status badge."""
    s = (status or "").upper()
    color_map = {
        "PRESENT": "#16a34a",
        "COMPLETED": "#16a34a",
        "APPROVED": "#16a34a",
        "RESOLVED": "#16a34a",
        "CHECKED_OUT": "#16a34a",
        "ABSENT": "#dc2626",
        "REJECTED": "#dc2626",
        "LEAVE": "#f59e0b",
        "PENDING": "#f59e0b",
        "IN_PROGRESS": "#3b82f6",
        "SKIPPED_ABSENT": "#8b5cf6",
        "HIGH": "#dc2626",
        "URGENT": "#dc2626",
        "MEDIUM": "#f59e0b",
        "LOW": "#64748b",
        "NORMAL": "#64748b",
    }
    return color_map.get(s, "#334155")


def _colored_status(status: str, style) -> Paragraph:
    """Creates a Paragraph with color-coded status text."""
    c = _status_color(status)
    display_status = status or EM_DASH
    return Paragraph(f'<font color="{c}"><b>{display_status}</b></font>', style)


# ──────────────────────────────────────────────
# Styles
# ──────────────────────────────────────────────

def _get_styles():
    """Returns all paragraph styles for the report."""
    base = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'WTitle', parent=base['Normal'],
        fontName='Helvetica-Bold', fontSize=16, leading=20,
        textColor=colors.HexColor('#0f172a'), alignment=1
    )
    subtitle_style = ParagraphStyle(
        'WSubtitle', parent=base['Normal'],
        fontName='Helvetica', fontSize=8.5, leading=11,
        textColor=colors.HexColor('#475569'), alignment=1
    )
    section_title_style = ParagraphStyle(
        'WSectionTitle', parent=base['Normal'],
        fontName='Helvetica-Bold', fontSize=12, leading=15,
        textColor=colors.HexColor('#1e3a8a'), spaceBefore=10, spaceAfter=4
    )
    kpi_style = ParagraphStyle(
        'WKPI', parent=base['Normal'],
        fontName='Helvetica-Bold', fontSize=9, leading=12,
        textColor=colors.HexColor('#0f172a'), alignment=1
    )
    cell_style = ParagraphStyle(
        'WCell', parent=base['Normal'],
        fontName='Helvetica', fontSize=7.5, leading=9.5,
        textColor=colors.HexColor('#1e293b')
    )
    cell_bold_style = ParagraphStyle(
        'WCellBold', parent=base['Normal'],
        fontName='Helvetica-Bold', fontSize=7.5, leading=9.5,
        textColor=colors.HexColor('#0f172a')
    )
    cell_center_style = ParagraphStyle(
        'WCellCenter', parent=base['Normal'],
        fontName='Helvetica', fontSize=7.5, leading=9.5,
        alignment=1, textColor=colors.HexColor('#1e293b')
    )
    header_cell_style = ParagraphStyle(
        'WHeaderCell', parent=base['Normal'],
        fontName='Helvetica-Bold', fontSize=8, leading=10,
        textColor=colors.white, alignment=1
    )
    meta_style = ParagraphStyle(
        'WMeta', parent=base['Normal'],
        fontName='Helvetica', fontSize=8, leading=10,
        textColor=colors.HexColor('#334155')
    )
    sign_style = ParagraphStyle(
        'WSign', parent=base['Normal'],
        fontName='Helvetica', fontSize=8.5, leading=12,
        textColor=colors.HexColor('#1e293b')
    )

    return {
        'title': title_style,
        'subtitle': subtitle_style,
        'section_title': section_title_style,
        'kpi': kpi_style,
        'cell': cell_style,
        'cell_bold': cell_bold_style,
        'cell_center': cell_center_style,
        'header_cell': header_cell_style,
        'meta': meta_style,
        'sign': sign_style,
    }


# ──────────────────────────────────────────────
# Table builder helper
# ──────────────────────────────────────────────

def _build_section_table(headers: list, rows: list, styles: dict,
                         col_widths=None, header_bg='#0f172a'):
    """Builds a formatted Table with header row and alternating row colors."""
    hc = styles['header_cell']
    table_data = [[Paragraph(f"<b>{h}</b>", hc) for h in headers]]
    table_data.extend(rows)

    t = Table(table_data, colWidths=col_widths, repeatRows=1)
    t_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(header_bg)),
        ('BOX', (0, 0), (-1, -1), 0.8, colors.HexColor('#94a3b8')),
        ('INNERGRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]
    for r_idx in range(1, len(table_data)):
        bg = colors.HexColor('#ffffff') if r_idx % 2 != 0 else colors.HexColor('#f8fafc')
        t_style.append(('BACKGROUND', (0, r_idx), (-1, r_idx), bg))

    t.setStyle(TableStyle(t_style))
    return t


CIRCLED_DIGITS = ["", "\u2460", "\u2461", "\u2462", "\u2463", "\u2464", "\u2465", "\u2466", "\u2467", "\u2468", "\u2469"]

def _section_title(num: int, title: str, style) -> Paragraph:
    """Returns a numbered section title paragraph with circled digits."""
    badge = CIRCLED_DIGITS[num] if 1 <= num < len(CIRCLED_DIGITS) else f"{num}."
    return Paragraph(f"{badge} {title}", style)


def _empty_notice(text: str, styles: dict):
    """Returns a styled 'no records' notice paragraph."""
    return Paragraph(f'<i><font color="#94a3b8">{text}</font></i>', styles['cell'])


# ──────────────────────────────────────────────
# Main PDF generator
# ──────────────────────────────────────────────

def generate_daily_warden_report_pdf(
    date_str: str,
    day_name: str,
    warden_email: str,
    attendance_data: list,
    cleaning_data: list,
    leaves_data: list,
    food_morning_session: dict,
    food_night_session: dict,
    food_roster: list,
    complaints_data: list,
    maintenance_data: list,
    visitors_data: list,
    announcements_data: list,
    audit_logs_data: list,
    rooms_data: list,
    food_morning_dish: str = "—",
    food_night_dish: str = "—",
) -> bytes:
    """
    Generates the comprehensive Daily Warden Report PDF.
    Returns raw PDF bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=25, rightMargin=25,
        topMargin=25, bottomMargin=32
    )

    S = _get_styles()
    formatted_date = _fmt_date(date_str)
    current_time = datetime.now().strftime("%d/%m/%Y, %I:%M %p")

    elements = []

    # ════════════════════════════════════════════
    # 1. HEADER
    # ════════════════════════════════════════════
    elements.append(Paragraph("VEERASHAIVA LINGAYATH BOYS HOSTEL", S['title']))
    elements.append(Paragraph(
        "Krushi Nagar, Shivamogga, Karnataka \u2022 Office of Hostel Warden",
        S['subtitle']
    ))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        f"DAILY WARDEN REPORT \u2014 {day_name.upper()}, {formatted_date}",
        ParagraphStyle('Badge', parent=S['section_title'], alignment=1, fontSize=13, textColor=colors.HexColor('#1e3a8a'))
    ))
    elements.append(Spacer(1, 6))

    # Metadata bar
    meta_data = [[
        Paragraph(f"<b>Report Date:</b> {formatted_date} ({day_name})", S['meta']),
        Paragraph(f"<b>Generated On:</b> {current_time}", S['meta']),
        Paragraph(f"<b>Warden:</b> {warden_email}", S['meta']),
    ]]
    meta_table = Table(meta_data, colWidths=[260, 260, 271])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
        ('BOX', (0, 0), (-1, -1), 0.8, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 8))

    # ════════════════════════════════════════════
    # 2. KPI SUMMARY BOXES
    # ════════════════════════════════════════════
    present_count = sum(1 for a in attendance_data if a.get("status") == "PRESENT")
    absent_count = sum(1 for a in attendance_data if a.get("status") == "ABSENT")
    leave_count_att = sum(1 for a in attendance_data if a.get("status") == "LEAVE")

    rooms_cleaned = sum(1 for c in cleaning_data if (c.get("status") or "").upper() == "COMPLETED")
    total_cleaning_rooms = len(cleaning_data) if cleaning_data else 13

    m_session = food_morning_session or {}
    n_session = food_night_session or {}
    m_tiffin = m_session.get("tiffin_count") or m_session.get("final_tiffin_count") or 0
    m_box = m_session.get("box_count") or m_session.get("final_box_count") or 0
    n_dinner = n_session.get("night_meal_count") or n_session.get("final_night_meal_count") or 0

    pending_leaves = sum(1 for l in leaves_data if l.get("status") == "PENDING")
    approved_leaves = sum(1 for l in leaves_data if l.get("status") == "APPROVED")
    open_complaints = sum(1 for c in complaints_data if c.get("status") not in ["RESOLVED", "CLOSED"])

    kpi_data = [[
        Paragraph(f'<b>Attendance Roll Call</b><br/><font color="#16a34a"><b>{present_count}</b></font> Present / <font color="#dc2626"><b>{absent_count}</b></font> Absent', S['kpi']),
        Paragraph(f'<b>Daily Cleaning</b><br/><font color="#16a34a"><b>{rooms_cleaned}</b></font> / {total_cleaning_rooms} Rooms Sanitized', S['kpi']),
        Paragraph(f'<b>Verified Meals</b><br/>🍱 <font color="#d97706"><b>{m_tiffin}</b></font> Tiffin / 🍽️ <font color="#7e22ce"><b>{n_dinner}</b></font> Dinner', S['kpi']),
        Paragraph(f'<b>Tiffin Boxes</b><br/>📦 <font color="#4338ca"><b>{m_box}</b></font> Packed Boxes', S['kpi']),
        Paragraph(f'<b>Leaves</b><br/><font color="#16a34a"><b>{approved_leaves}</b></font> Approved ({pending_leaves} Pend)', S['kpi']),
        Paragraph(f'<b>Complaints</b><br/><font color="#dc2626"><b>{open_complaints}</b></font> Open Tickets', S['kpi']),
    ]]
    kpi_table = Table(kpi_data, colWidths=[132, 132, 132, 132, 132, 131])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#94a3b8')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 12))

    sec_num = 1

    # ════════════════════════════════════════════
    # 3. ATTENDANCE SUMMARY (per room)
    # ════════════════════════════════════════════
    elements.append(_section_title(sec_num, "ATTENDANCE ROLL CALL & NIGHT CURFEW", S['section_title']))
    sec_num += 1

    if attendance_data:
        # Group by room
        room_att = {}
        for a in attendance_data:
            r_no = a.get("room_number", "Unknown")
            if r_no not in room_att:
                room_att[r_no] = {"present": 0, "absent": 0, "leave": 0, "students": []}
            st = a.get("status", "ABSENT")
            if st == "PRESENT":
                room_att[r_no]["present"] += 1
            elif st == "LEAVE":
                room_att[r_no]["leave"] += 1
            else:
                room_att[r_no]["absent"] += 1
            room_att[r_no]["students"].append(a)

        att_headers = ["#", "Room", "Present", "Absent", "Leave", "Total", "Students (Absent/Leave)"]
        att_rows = []
        for idx, (r_no, info) in enumerate(sorted(room_att.items()), 1):
            total = info["present"] + info["absent"] + info["leave"]
            absent_names = [s.get("student_name", "\u2014") for s in info["students"]
                          if s.get("status") in ["ABSENT", "LEAVE"]]
            absent_str = ", ".join(absent_names[:5]) if absent_names else "\u2014"
            att_rows.append([
                Paragraph(str(idx), S['cell_center']),
                Paragraph(f"<b>{r_no}</b>", S['cell_bold']),
                Paragraph(f'<font color="#16a34a"><b>{info["present"]}</b></font>', S['cell_center']),
                Paragraph(f'<font color="#dc2626"><b>{info["absent"]}</b></font>', S['cell_center']),
                Paragraph(f'<font color="#f59e0b"><b>{info["leave"]}</b></font>', S['cell_center']),
                Paragraph(str(total), S['cell_center']),
                Paragraph(absent_str, S['cell']),
            ])

        t = _build_section_table(att_headers, att_rows, S,
                                  col_widths=[25, 65, 55, 55, 55, 50, 486])
        elements.append(t)
    else:
        elements.append(_empty_notice("No attendance records found for this date.", S))
    elements.append(Spacer(1, 10))

    # ════════════════════════════════════════════
    # 4. ROOM CLEANING & SANITATION (WHOLE HOSTEL DAILY ROUTINE)
    # ════════════════════════════════════════════
    elements.append(_section_title(sec_num, "ROOM CLEANING & SANITATION STATUS (WHOLE HOSTEL DAILY ROUTINE)", S['section_title']))
    sec_num += 1

    if cleaning_data:
        cl_headers = ["#", "Room", "Resident Occupancy", "Daily Cleaning Status", "Assigned Staff", "Sanitation Scope", "Status Notes"]
        cl_rows = []
        for idx, c in enumerate(cleaning_data, 1):
            status = c.get("status", "PENDING")
            res_count = c.get("residents_count", 0)
            res_str = f"{res_count} Residents" if res_count else "Vacant Room"
            notes_str = str(c.get("notes") or c.get("last_cleaned") or "Whole Hostel Daily Sanitation")[:48]
            cl_rows.append([
                Paragraph(str(idx), S['cell_center']),
                Paragraph(f"<b>{c.get('room_number', EM_DASH)}</b>", S['cell_bold']),
                Paragraph(res_str, S['cell_center']),
                _colored_status(status, S['cell_center']),
                Paragraph(c.get("assigned_staff", "Housekeeping Staff"), S['cell']),
                Paragraph("Whole Hostel", S['cell_center']),
                Paragraph(notes_str, S['cell']),
            ])
        t = _build_section_table(cl_headers, cl_rows, S,
                                  col_widths=[25, 75, 125, 125, 140, 115, 186], header_bg='#166534')
        elements.append(t)
    else:
        elements.append(_empty_notice("No daily cleaning records available.", S))
    elements.append(Spacer(1, 10))

    # ════════════════════════════════════════════
    # 5. VERIFIED KITCHEN MEAL COUNTS & FOOD ROSTER
    # ════════════════════════════════════════════
    elements.append(_section_title(sec_num, "VERIFIED KITCHEN MEAL COUNTS & RESIDENT FOOD ROSTER", S['section_title']))
    sec_num += 1

    m_status = m_session.get("status", "Pending Verification")
    n_status = n_session.get("status", "Pending Verification")
    m_sub_by = m_session.get("submitted_by") or "Hostel Cleaning Team"
    n_sub_by = n_session.get("submitted_by") or "Hostel Warden"

    m_dish_text = food_morning_dish or "Routine Breakfast"
    n_dish_text = food_night_dish or "Routine Dinner"

    meal_card_data = [
        [
            Paragraph("<b>🌅 MORNING TIFFIN SESSION (CLEANING TEAM VERIFIED)</b>", S['cell_bold']),
            Paragraph("<b>🌙 NIGHT MEAL SESSION (WARDEN VERIFIED)</b>", S['cell_bold']),
        ],
        [
            Paragraph(
                f"<b>Allocated Menu:</b> <font color='#92400e'><b>{m_dish_text}</b></font><br/>"
                f"<b>Verification Status:</b> <font color='#16a34a'><b>{m_status}</b></font><br/>"
                f"<b>🍱 Verified Tiffin Count:</b> <font color='#0f172a' size='8.5'><b>{m_tiffin}</b></font>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;"
                f"<b>📦 Verified Box Count:</b> <font color='#4338ca' size='8.5'><b>{m_box}</b></font><br/>"
                f"<i>Verified By: {m_sub_by}</i>",
                S['cell']
            ),
            Paragraph(
                f"<b>Allocated Menu:</b> <font color='#6b21a8'><b>{n_dish_text}</b></font><br/>"
                f"<b>Verification Status:</b> <font color='#16a34a'><b>{n_status}</b></font><br/>"
                f"<b>🍽️ Verified Dinner Count:</b> <font color='#0f172a' size='8.5'><b>{n_dinner}</b></font><br/>"
                f"<i>Verified By: {n_sub_by}</i>",
                S['cell']
            ),
        ]
    ]
    meal_card_table = Table(meal_card_data, colWidths=[395, 396])
    meal_card_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#fef3c7')),
        ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#f3e8ff')),
        ('BACKGROUND', (0, 1), (0, 1), colors.HexColor('#fffbeb')),
        ('BACKGROUND', (1, 1), (1, 1), colors.HexColor('#faf5ff')),
        ('BOX', (0, 0), (0, -1), 0.8, colors.HexColor('#d97706')),
        ('BOX', (1, 0), (1, -1), 0.8, colors.HexColor('#9333ea')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(meal_card_table)

    if food_roster:
        elements.append(Spacer(1, 4))
        present_roster = [r for r in food_roster if r.get("attendance_status") == "PRESENT"]
        if not present_roster:
            present_roster = food_roster

        fd_headers = ["#", "Room", "Resident Name", "Morning Tiffin", "Tiffin Box", "Night Dinner"]
        fd_rows = []
        for idx, r in enumerate(present_roster[:45], 1):
            tif = "YES" if r.get("tiffin_required") else "No"
            box = "YES" if r.get("box_required") else "No"
            din = "YES" if r.get("meal_required") else "No"
            tif_c = "#16a34a" if r.get("tiffin_required") else "#94a3b8"
            box_c = "#4338ca" if r.get("box_required") else "#94a3b8"
            din_c = "#7e22ce" if r.get("meal_required") else "#94a3b8"
            fd_rows.append([
                Paragraph(str(idx), S['cell_center']),
                Paragraph(r.get("room_number", "\u2014"), S['cell_center']),
                Paragraph(f"<b>{r.get('name', EM_DASH)}</b>", S['cell_bold']),
                Paragraph(f'<font color="{tif_c}"><b>{tif}</b></font>', S['cell_center']),
                Paragraph(f'<font color="{box_c}"><b>{box}</b></font>', S['cell_center']),
                Paragraph(f'<font color="{din_c}"><b>{din}</b></font>', S['cell_center']),
            ])
        t = _build_section_table(fd_headers, fd_rows, S,
                                  col_widths=[30, 75, 386, 100, 100, 100], header_bg='#92400e')
        elements.append(t)
        if len(present_roster) > 45:
            elements.append(Paragraph(
                f'<i><font color="#94a3b8">... and {len(present_roster) - 45} more residents (see full food roster report)</font></i>',
                S['cell']
            ))
    elements.append(Spacer(1, 10))

    # ════════════════════════════════════════════
    # 6. LEAVE APPLICATIONS
    # ════════════════════════════════════════════
    if leaves_data:
        elements.append(_section_title(sec_num, "LEAVE APPLICATIONS", S['section_title']))
        sec_num += 1
        lv_headers = ["#", "Student", "Room", "Type", "From", "To", "Reason", "Status", "Warden Remarks"]
        lv_rows = []
        for idx, l in enumerate(leaves_data, 1):
            lv_rows.append([
                Paragraph(str(idx), S['cell_center']),
                Paragraph(f"<b>{l.get('student_name', EM_DASH)}</b>", S['cell_bold']),
                Paragraph(l.get("room_number", "\u2014"), S['cell_center']),
                Paragraph(l.get("leave_type", "\u2014"), S['cell_center']),
                Paragraph(_fmt_date(l.get("from_date", "")), S['cell_center']),
                Paragraph(_fmt_date(l.get("to_date", "")), S['cell_center']),
                Paragraph(str(l.get("reason", "\u2014"))[:50], S['cell']),
                _colored_status(l.get("status", "PENDING"), S['cell_center']),
                Paragraph(str(l.get("admin_remarks", "\u2014"))[:40], S['cell']),
            ])
        t = _build_section_table(lv_headers, lv_rows, S,
                                  col_widths=[25, 100, 50, 60, 65, 65, 155, 75, 196], header_bg='#1e40af')
        elements.append(t)
        elements.append(Spacer(1, 10))

    # ════════════════════════════════════════════
    # 7. COMPLAINTS & SERVICE TICKETS
    # ════════════════════════════════════════════
    if complaints_data:
        elements.append(_section_title(sec_num, "COMPLAINTS & SERVICE TICKETS", S['section_title']))
        sec_num += 1
        cp_headers = ["#", "Ticket", "Student", "Room", "Category", "Priority", "Status", "Staff", "Created"]
        cp_rows = []
        for idx, c in enumerate(complaints_data, 1):
            created = _fmt_datetime(c.get("created_at"))
            cp_rows.append([
                Paragraph(str(idx), S['cell_center']),
                Paragraph(f"<b>{c.get('ticket_id', EM_DASH)}</b>", S['cell_bold']),
                Paragraph(c.get("student_name", "\u2014"), S['cell']),
                Paragraph(c.get("room_number", "\u2014"), S['cell_center']),
                Paragraph(c.get("category", "\u2014"), S['cell']),
                _colored_status(c.get("priority", "NORMAL"), S['cell_center']),
                _colored_status(c.get("status", "PENDING"), S['cell_center']),
                Paragraph(c.get("assigned_staff", "\u2014"), S['cell']),
                Paragraph(created, S['cell_center']),
            ])
        t = _build_section_table(cp_headers, cp_rows, S,
                                  col_widths=[25, 70, 100, 50, 90, 60, 75, 120, 201], header_bg='#b45309')
        elements.append(t)
        elements.append(Spacer(1, 10))

    # ════════════════════════════════════════════
    # 8. MAINTENANCE REQUESTS (Only if records exist)
    # ════════════════════════════════════════════
    if maintenance_data:
        elements.append(_section_title(sec_num, "MAINTENANCE REQUESTS", S['section_title']))
        sec_num += 1
        mt_headers = ["#", "Student", "Room", "Category", "Description", "Priority", "Status", "Staff"]
        mt_rows = []
        for idx, m in enumerate(maintenance_data, 1):
            mt_rows.append([
                Paragraph(str(idx), S['cell_center']),
                Paragraph(f"<b>{m.get('student_name', EM_DASH)}</b>", S['cell_bold']),
                Paragraph(m.get("room_number", "\u2014"), S['cell_center']),
                Paragraph(m.get("category", "\u2014"), S['cell']),
                Paragraph(str(m.get("description", "\u2014"))[:60], S['cell']),
                _colored_status(m.get("priority", "NORMAL"), S['cell_center']),
                _colored_status(m.get("status", "PENDING"), S['cell_center']),
                Paragraph(m.get("assigned_staff", "\u2014"), S['cell']),
            ])
        t = _build_section_table(mt_headers, mt_rows, S,
                                  col_widths=[25, 100, 55, 90, 220, 65, 75, 161], header_bg='#7c3aed')
        elements.append(t)
        elements.append(Spacer(1, 10))

    # ════════════════════════════════════════════
    # 9. VISITOR LOG (Only if records exist)
    # ════════════════════════════════════════════
    if visitors_data:
        elements.append(_section_title(sec_num, "VISITOR LOG", S['section_title']))
        sec_num += 1
        vs_headers = ["#", "Visitor Name", "Relation", "Student", "Room", "Phone", "Entry", "Exit", "Purpose"]
        vs_rows = []
        for idx, v in enumerate(visitors_data, 1):
            vs_rows.append([
                Paragraph(str(idx), S['cell_center']),
                Paragraph(f"<b>{v.get('visitor_name', EM_DASH)}</b>", S['cell_bold']),
                Paragraph(v.get("relation", "\u2014"), S['cell']),
                Paragraph(v.get("student_name", "\u2014"), S['cell']),
                Paragraph(v.get("room_number", "\u2014"), S['cell_center']),
                Paragraph(v.get("phone", "\u2014"), S['cell_center']),
                Paragraph(v.get("entry_time", "\u2014"), S['cell_center']),
                Paragraph(v.get("exit_time", "\u2014"), S['cell_center']),
                Paragraph(str(v.get("purpose", "\u2014"))[:50], S['cell']),
            ])
        t = _build_section_table(vs_headers, vs_rows, S,
                                  col_widths=[25, 95, 65, 90, 50, 80, 75, 75, 236], header_bg='#0369a1')
        elements.append(t)
        elements.append(Spacer(1, 10))

    # ════════════════════════════════════════════
    # 10. ANNOUNCEMENTS (Only if records exist)
    # ════════════════════════════════════════════
    if announcements_data:
        elements.append(_section_title(sec_num, "ANNOUNCEMENTS", S['section_title']))
        sec_num += 1
        an_headers = ["#", "Title", "Priority", "Description", "Author", "Posted"]
        an_rows = []
        for idx, a in enumerate(announcements_data, 1):
            posted = _fmt_datetime(a.get("created_at"))
            an_rows.append([
                Paragraph(str(idx), S['cell_center']),
                Paragraph(f"<b>{a.get('title', EM_DASH)}</b>", S['cell_bold']),
                _colored_status(a.get("priority", "NORMAL"), S['cell_center']),
                Paragraph(str(a.get("description", "\u2014"))[:80], S['cell']),
                Paragraph(a.get("author", "\u2014"), S['cell']),
                Paragraph(posted, S['cell_center']),
            ])
        t = _build_section_table(an_headers, an_rows, S,
                                  col_widths=[25, 150, 65, 280, 130, 141], header_bg='#4338ca')
        elements.append(t)
        elements.append(Spacer(1, 10))

    # ════════════════════════════════════════════
    # 11. AUDIT TRAIL (last 30 entries if exist)
    # ════════════════════════════════════════════
    if audit_logs_data:
        elements.append(_section_title(sec_num, "AUDIT TRAIL", S['section_title']))
        sec_num += 1
        au_headers = ["#", "User", "Action", "Module", "Target", "Details", "Timestamp"]
        au_rows = []
        for idx, a in enumerate(audit_logs_data[:30], 1):
            ts = _fmt_datetime(a.get("timestamp") or a.get("created_at"))
            au_rows.append([
                Paragraph(str(idx), S['cell_center']),
                Paragraph(a.get("user", "\u2014"), S['cell']),
                Paragraph(f"<b>{a.get('action', EM_DASH)}</b>", S['cell_bold']),
                Paragraph(a.get("module", "\u2014"), S['cell_center']),
                Paragraph(str(a.get("target", "\u2014"))[:30], S['cell']),
                Paragraph(str(a.get("details", "\u2014"))[:50], S['cell']),
                Paragraph(ts, S['cell_center']),
            ])
        t = _build_section_table(au_headers, au_rows, S,
                                  col_widths=[25, 120, 110, 70, 100, 195, 171], header_bg='#334155')
        elements.append(t)
        if len(audit_logs_data) > 30:
            elements.append(Paragraph(
                f'<i><font color="#94a3b8">Showing first 30 of {len(audit_logs_data)} audit entries.</font></i>',
                S['cell']
            ))
        elements.append(Spacer(1, 16))

    # ════════════════════════════════════════════
    # 12. SIGN-OFF BLOCK
    # ════════════════════════════════════════════
    sign_data = [
        [
            Paragraph("<b>Prepared By (System Generated):</b>", S['sign']),
            Paragraph("<b>Verified By (Hostel Warden):</b>", S['sign']),
            Paragraph("<b>Approved By (Chief Warden / Principal):</b>", S['sign']),
        ],
        [
            Paragraph(
                f"Smart Hostel Management System<br/>Date: {formatted_date}<br/>Time: {current_time}",
                S['sign']
            ),
            Paragraph(
                f"Name: ____________________________<br/>"
                f"Signature: ________________________<br/>"
                f"Date: {formatted_date}",
                S['sign']
            ),
            Paragraph(
                "Name: ____________________________<br/>"
                "Signature: ________________________<br/>"
                f"Date: {formatted_date}",
                S['sign']
            ),
        ]
    ]
    sign_table = Table(sign_data, colWidths=[263, 263, 264])
    sign_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('BACKGROUND', (0, 1), (-1, 1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 0.8, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(KeepTogether([sign_table]))

    # Build PDF
    doc.build(elements, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()
