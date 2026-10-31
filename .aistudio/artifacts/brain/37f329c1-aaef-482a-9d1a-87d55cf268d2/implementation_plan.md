# Official Parent Attendance & Leave PDF Report — Plan for Class Leader & Class Usthad

This plan introduces a professional **Parent Attendance & Leave PDF Report** generator accessible to both **Class Leaders** and **Class Usthads**. It compiles each student's monthly attendance, period-by-period attendance (including the 4-option Absent/Leave reasons), and leave register history into an official, print-ready ICS Academy document that can be **downloaded as a PDF** or **printed** to share with parents.

## User Review & Critical Decisions

> [!IMPORTANT]
> All choices confirmed during our interactive clarification are incorporated below:

- **Confirmed Decision 1 — Comprehensive Attendance, Period & Leave Content**: Each student's report includes:
  1. **Monthly Attendance Summary** (`Present`, `Absent`, `Leave` days, overall & monthly percentage, and recorded Absent/Leave reasons).
  2. **Period-by-Period Attendance Table** (showing `Period 1` to `Period 5`, Subject, Usthad, Time, Status, and the specific **Reason** selected when marked `Absent` or `Leave`).
  3. **Campus Leave & Return Register Log** (showing departure/return dates, times, leave reasons, and remarks).
- **Confirmed Decision 2 — Official Academy Branding & Usthad Signature Block**: The PDF features the **ICS Academy Manhappatta (Da'wa College)** logo and letterhead, a structured **Student Profile** box (Name, Admission No., Class & Batch, Class Usthad), and an official **Class Usthad Signature** column at the bottom.
- **Confirmed Decision 3 — Download PDF & Print Options**: Both Class Leaders and Class Usthads can open a live **A4 Report Preview** for any student in their class and either **Download PDF** directly or **Print** the report.

---

## 1. Overview & Core Concept

- **What It Does**: Allows a Class Leader or Class Usthad to click **"Parent PDF"** next to any student in their class (or from the Attendance/Leave panel) to preview, download, or print a structured, parent-friendly official report.
- **Target Audience / Persona**: Class Leaders (Tier 02) and Class Usthads (Tier 03) preparing individual progress, attendance, and leave statements for parents/guardians.
- **Key Value**: Gives parents complete transparency into their child's overall attendance, daily period participation, and exact reasons for any absences or leaves in a clean, authoritative layout.

---

## 2. User Experience & Visual Design

### Professional PDF Document Structure (A4 Portrait Layout)
```
┌────────────────────────────────────────────────────────────────────────────┐
│  [ICS LOGO]   ICS ACADEMY MANHAPPATTA — DA'WA COLLEGE PORTAL               │
│               Official Student Attendance & Leave Report (For Parents)     │
│               Academic Year 2026–27  •  Report Date: DD MMM YYYY           │
├────────────────────────────────────────────────────────────────────────────┤
│  STUDENT PROFILE                                                           │
│  • Name: Muhammed Sinan             • Admission No.: ICS2K261401           │
│  • Class & Batch: 8th • Batch 14    • Class Usthad: Usthad Zubair Wafy     │
│  • Current Campus Status: At Academy / On Leave   • Overall Rate: 94.2%    │
├────────────────────────────────────────────────────────────────────────────┤
│  SECTION 1: ACADEMIC YEAR & MONTHLY ATTENDANCE SUMMARY                     │
│  ┌──────────────┬─────────┬─────────┬─────────┬────────────┬────────────┐  │
│  │ Month        │ Present │ Absent  │ Leave   │ Rate (%)   │ Reason/Note│  │
│  ├──────────────┼─────────┼─────────┼─────────┼────────────┼────────────┤  │
│  │ October 2026 │   21    │    1    │    1    │   91.3%    │ Sick / ... │  │
│  └──────────────┴─────────┴─────────┴─────────┴────────────┴────────────┘  │
├────────────────────────────────────────────────────────────────────────────┤
│  SECTION 2: DAILY PERIOD-BY-PERIOD ATTENDANCE & REASONS                    │
│  ┌──────────┬──────────────────────┬───────────────┬─────────┬──────────┐  │
│  │ Period   │ Subject & Usthad     │ Time Slot     │ Status  │ Reason   │  │
│  ├──────────┼──────────────────────┼───────────────┼─────────┼──────────┤  │
│  │ Period 1 │ Mizan & Sarf         │ 07:15 – 08:05 │ Present │ —        │  │
│  │ Period 2 │ Fiqh (Mabadi)        │ 08:30 – 09:20 │ Absent  │ Sick/... │  │
│  └──────────┴──────────────────────┴───────────────┴─────────┴──────────┘  │
├────────────────────────────────────────────────────────────────────────────┤
│  SECTION 3: CAMPUS LEAVE & RETURN REGISTER HISTORY                         │
│  ┌──────────────┬──────────────┬───────────────────────────┬────────────┐  │
│  │ Date & Time  │ Entry Type   │ Leave Reason              │ Details    │  │
│  ├──────────────┼──────────────┼───────────────────────────┼────────────┤  │
│  │ 28 Oct, 4 PM │ Leave Out    │ Medical / Hospital Visit  │ Approved   │  │
│  └──────────────┴──────────────┴───────────────────────────┴────────────┘  │
├────────────────────────────────────────────────────────────────────────────┤
│  Generated by: Class Leader / Class Usthad                                 │
│                                                                            │
│                                      ____________________________________  │
│                                      Signature of Class Usthad & Seal      │
│                                      (Usthad Name • Staff ID)              │
└────────────────────────────────────────────────────────────────────────────┘
```

### Entry Points in Both Dashboards
1. **In Class Leader & Usthad Period Attendance Table**: Every student row includes a **"Parent PDF"** button that opens that student's report for the selected date and academic year.
2. **In Class Usthad Dashboard**:
   - **Class Students & Profiles Roster**: Quick-action **"Parent PDF"** button on every student row.
   - **Attendance Status & Update Card**: **"Download / Print Parent PDF"** button for the currently selected student.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Dual Output: Direct Vector PDF Download (`jsPDF`) + Native A4 Print Sheet**
  - *Chosen Approach*: Provide an interactive A4 preview modal with both a **Download PDF** button (generating a crisp, multi-table `.pdf` file with the embedded ICS Academy logo, student tables, reasons, and signature block) and a **Print Report** button.
  - *Why*: Downloading a `.pdf` file makes it effortless to send the file to parents on mobile or desktop, while printing supports physical distribution during parent-teacher meetings.
- **Decision 2 — Live Data Aggregation Across All Three Stores**
  - *Chosen Approach*: Dynamically combine data from Monthly Attendance Overrides (`ics_attendance_overrides_v1`), Period-by-Period Submissions (`ics_period_attendance_v1`), and Student Leave Records (`ics_leave_records_<studentId>`) at the moment the report is opened.
  - *Why*: Ensures any update just made by the Class Leader or Class Usthad—including the 4 Absent/Leave reasons—is immediately reflected in the PDF sent to parents.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Class Leader Dashboard                     Class Usthad Dashboard         │
│  • Period Attendance Student Rows           • Student Roster Table         │
│                                             • Monthly Attendance Card      │
│                                             • Period Attendance Card       │
└───────────────────┬────────────────────────────────────────┬───────────────┘
                    │ Clicks "Parent PDF" for Student        │
                    ▼                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                  ParentReportModal (A4 Preview + PDF Engine)               │
│  • Aggregates:                                                             │
│    1. Effective Monthly Attendance + Absent/Leave Reasons                  │
│    2. Selected Date Period-by-Period Status + 4-Option Reasons             │
│    3. Student Leave & Return Register Entries                              │
│  • Actions:                                                                │
│    ├─► [Download PDF] -> Builds structured A4 PDF via jsPDF + Logo         │
│    └─► [Print Report] -> Prints A4 formatted report sheet                  │
└────────────────────────────────────────────────────────────────────────────┘
```
