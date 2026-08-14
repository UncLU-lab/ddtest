Demurrage Defender — Screen 02: Create new shipment (Figma build prompt)
Design a multi-step form page for creating a new shipment inside the Demurrage Defender SaaS app. Same design system as the ops dashboard: Inter font, white/light-grey surfaces, 0.5px borders #E5E7EB, border-radius 8px (elements) / 12px (cards), no gradients or shadows.

Page layout — 1440px desktop frame
Top navigation bar: identical to ops dashboard (logo + app name left, breadcrumb "Operations / New shipment" centre, "Save draft" ghost button + "Cancel" text link right).
Below nav: page header — "Create new shipment" (18px/500) + subtitle "Initialise a maritime cargo operation and set up laytime clocks" (13px muted).
Step indicator (full width, border-bottom #E5E7EB, 2px active underline #1A4ED8):

Step 1: "Vessel & cargo" — done state (green circle with checkmark)
Step 2: "Deal framework" — active (blue circle "2", blue underline)
Step 3: "Laytime terms" — inactive (grey circle "3")
Step 4: "Parties & review" — inactive (grey circle "4")

Main content: two-column grid. Left column (fills remaining width) stacks three form cards. Right column fixed 220px.

Left column — 3 stacked form cards (white bg, border #E5E7EB, border-radius 12px, padding 16px 18px, gap 14px between cards)
Card 1 — Vessel & cargo (eyebrow: ship icon + "Vessel & cargo" uppercase 11px muted)

Row 1 (2 cols): Vessel name (filled: "BW Magnolia") / Voyage ref. (filled: "VOY-2311")
Row 2 (3 cols): Product type select (LNG selected) / Quantity MT (65000) / ETA date (2023-10-25)
Row 3 (2 cols): Load port ("Sabine Pass, TX") / Discharge port ("Singapore")

Card 2 — Deal framework (eyebrow: document icon + "Deal framework")

Three toggle mode buttons (equal 3-col grid, border 0.5px, border-radius 8px, padding 9px, text-align centre):

"Spot recap" / icon: edit pencil / sub "Manual entry" — inactive
"Term agreement" / icon: template / sub "Supplier template" — ACTIVE (border #1A4ED8, bg #EFF6FF, icon blue)
"Upload contract" / icon: upload / sub "Auto-extraction" — inactive

Below modes:

Row (2 cols): Supplier select ("Vitol Asia", hint text "Template auto-fills known terms" 10px muted below) / Receiver select ("PetroChina")
Row (1 col): Intermediary / trader text input (placeholder "Search entity database…")

Card 3 — Laytime terms (eyebrow: clock icon + "Laytime terms")
Sub-section label "Supplier clock" (11px muted)

Row (2 cols): Laycan open date (2023-10-23) / Laycan close date (2023-10-27)
Row (3 cols): Laytime allowed number (72, label "hrs") / Demurrage rate $/day (25000) / Dispatch rate $/day (12500)
Row (2 cols): Time counting basis select ("6h SHINC") / NOR notice period select ("6 hours")

Horizontal divider 0.5px
Sub-section label "Receiver clock" + pill badge "independent" (bg #F3F4F6, text #6B7280, 10px)

Row (2 cols): Receiver laycan open (2023-10-24) / Receiver laycan close (2023-10-28)
Row (2 cols): Laytime allowed (48) / Demurrage rate (22000)

Horizontal divider 0.5px
Sub-section label "Deductible delay categories" (11px muted)

Pill tags (border-radius 999px, border 0.5px, font 11px, padding 3px 9px, gap 6px, wrap):

ACTIVE (bg #EFF6FF, border #1A4ED8, text #1E40AF): "Rain / weather", "Berth congestion", "Terminal downtime"
INACTIVE (bg white, border #E5E7EB, text muted): "Mechanical breakdown", "Tide / draft", "Documentation", "Shifting"


Right column — 220px sidebar (3 stacked components, gap 12px)
Component 1 — Shipment summary (bg #F9FAFB, border-radius 12px, padding 14px 16px)

Eyebrow "Shipment summary" uppercase 10px muted. Key-value rows (12px, flex space-between, gap 7px):

Vessel / BW Magnolia · Route / Sabine → SG · ETA / 25 Oct 14:30 · Supplier / Vitol Asia · Receiver / PetroChina · Laytime / 72h SHINC (blue #1A4ED8) · Demurrage / $25,000/day
Component 2 — Pre-ops risk preview (white bg, border #E5E7EB, border-radius 12px, padding 14px 16px)

Eyebrow "Pre-ops risk preview" uppercase 10px muted. Three risk rows (each: 80px label + horizontal bar track + % value):

Laycan breach: 38% amber bar (#F59E0B), value colour #B45309
Port delay: 62% red bar (#EF4444), value colour #C53030
Clock mismatch: 24% green bar (#10B981), value colour #276749

Bar track: height 5px, bg #F3F4F6, border-radius 3px, fill clips left to right.

Footer note (10px muted, border-top 0.5px): "Based on Singapore terminal data · last 90 days"

Component 3 — Required fields missing (eyebrow "Required fields missing" 10px muted)

Two warning pills (bg #FFFBEB, border #FDE68A, text #B45309, border-radius 8px, padding 7px 10px, font 11px, icon: amber triangle warning, gap 6px):

"Charterer / owner not set"
"NOR validity conditions"

Action buttons (full width, stacked, gap 8px):

"Initialise shipment" — solid #1A4ED8, white text, 13px/500, height 40px, border-radius 8px
"Save draft" — ghost button, border #E5E7EB, 13px, height 38px


Component notes

All form inputs: height 34px, border 0.5px #E5E7EB, border-radius 8px, font 12px, focus state border #1A4ED8
Selects: right-chevron arrow icon, no system appearance
Required field asterisk: red #EF4444
Create components for: mode toggle button (3 states), risk bar row, tag pill (2 states), warning pill, form field group (label + input + hint)
Use Figma variables for all colour tokens