PART 2 — COMPONENT LIBRARY
Create a dedicated "Components" page. Build each component as a master component with all variants and states before building any screens. Use auto-layout throughout — every component must resize correctly when content changes.
Component 01 — Top navigation bar
Frame: width fill container, height 56px, horizontal auto-layout, align centre, padding 0 20px, border-bottom 0.5px border/default.
Left slot: logo mark (28×28px, radius/md, background accent/blue, anchor icon white 14px) + app name (Title/15/Medium) + optional subtitle (Label/11/Regular, text/secondary). Gap 9px between logo and text block.
Centre slot: nav pill group, horizontal auto-layout, gap 2px. Nav pill component (see below).
Right slot: icon button (bell, search — see below) + avatar circle (see below). Gap 8px.
Nav pill sub-component: padding 5px 10px, radius/md, Body/12/Regular. Variants: Default (text/secondary, no background), Hover (background/secondary, text/primary), Active (background/secondary, text/primary, font 500).
Component 02 — KPI card
Frame: auto-layout vertical, padding 11px 13px, radius/lg, background/secondary, no border. Min-width 120px.
Slots: label (Label/10/Uppercase, text/secondary) + value (Display/22/Medium, colour override property) + sub-label (Label/11/Regular, text/secondary).
Variants property "colour": Neutral (text/primary value), Red (critical/text), Amber (elevated/text), Green (optimal/text), Blue (accent/blue).
Component 03 — Badge / pill
Frame: horizontal auto-layout, padding 3px 8px, radius/pill, align centre, gap 4px.
Variants:

Colour: Blue / Green / Amber / Red / Gray / Purple
Size: Standard (10px text) / Compact (9px text)

Each colour variant: fill from semantic fill token, text from semantic text token. Never use plain black text on coloured badge.
Optional slot: leading dot (5×5px circle, same colour family as text, radius/pill).
Component 04 — Risk badge
Extends badge. Three fixed variants only — Critical (red), Elevated (amber), Optimal (green). Always includes 5px dot. Label fixed: "Critical" / "Elevated" / "Optimal". Not editable — use badge component for custom labels.
Component 05 — Toggle switch
Frame: 36×20px, radius/pill, no auto-layout (manual positioning).
OFF state: background border/default, dot (14×14px white circle, radius/pill, positioned left: 2px, top: 2px).
ON state: background accent/blue, dot (positioned right: 2px, top: 2px).
Build as component with boolean property "on" toggling between states.
Component 06 — Data table row
Frame: width fill, height 40px minimum, horizontal auto-layout, padding 10px 10px, border-bottom 0.5px border/default. Align centre.
Variant "state": Default (no background), Hover (background/secondary), Selected (background/secondary + border 0.5px border/emphasis), Deductible (background elevated/fill + border-left none).
Optional "accent bar" boolean property: when true, prepend a 3px × 34px coloured rectangle flush left (no radius). Colour property for accent bar: Red / Amber / Green.
Slots (using instance swap): vessel name cell / generic text cell / badge cell / exposure cell (right-aligned, coloured text) / action cell.
Component 07 — Form field group
Frame: auto-layout vertical, gap 4px, width fill.
Slots: label (Label/11/Medium, text/primary) + optional required asterisk (Label/11/Medium, critical/text) + input element + optional hint text (Label/11/Regular, text/secondary) + optional error text (Label/11/Regular, critical/text).
Input element variants:

Type: Text / Select / Date / Number / Textarea
State: Default (border border/default) / Focused (border accent/blue, 1px) / Filled (border border/default) / Error (border critical/border) / Disabled (background/secondary, text/tertiary)
Height: 34px for text/select/date/number, 80px for textarea
Font: Body/12/Regular
Padding: 7px 10px

Select type: add chevron-down icon right-aligned inside input, 14px, text/secondary.
Component 08 — Button
Variants "type": Primary / Secondary / Danger / Success / Ghost / Link

Variants "size": Default (36px height, 12px padding horizontal) / Small (28px height, 9px padding horizontal)

Variants "state": Default / Hover / Pressed / Loading / Disabled
Primary: background accent/blue, text white, radius/md, Body/12/Medium.

Secondary: background transparent, border 0.5px border/default, text/primary.

Danger: background critical/fill, border critical/border, text critical/text.

Success: background optimal/fill, border optimal/border, text optimal/text (or solid #276749 with white text for filled variant).

Ghost: no background, no border, text/secondary.
Optional leading icon slot (Tabler outline, 13px, inherits button text colour). Optional trailing arrow "↗" for navigation actions.
Loading state: replace label with 16px spinner icon, same colours.
Disabled state: 40% opacity on entire component.
Component 09 — Alert strip
Frame: horizontal auto-layout, padding 9px 12px, radius/md, gap 8px, width fill, align flex-start.
Variants "type": Warning (elevated/fill bg, elevated/border, amber triangle icon) / Danger (critical/fill, critical/border, red triangle) / Info (blue tint #EFF6FF bg, #BFDBFE border, blue info icon) / Success (optimal/fill, optimal/border, green check icon).
Icon slot: Tabler outline icon 14px, flex-shrink 0, margin-top 1px.

Text slot: auto-layout vertical, gap 2px. Optional bold title (Body/12/Medium) + body text (Label/11/Regular, text/secondary).
Component 10 — Tag pill
Frame: padding 3px 9px, radius/pill, border 0.5px, Body/11/Regular.
Variants "state": Default (border/default border, text/secondary text, transparent bg) / Active (accent/blue border, #EFF6FF bg, #1E40AF text) / Disabled (border/default, text/tertiary, background/secondary).
Component 11 — Avatar circle
Frame: fixed size, radius/pill, horizontal + vertical centre align, overflow hidden.
Variants "size": Small 28px (Label/11/Medium) / Medium 32px (Body/12/Medium) / Large 44px (Body/14/Medium).

Variants "colour": Blue (#DBEAFE bg, #1E40AF text) / Green (#C6F6D5, #22543D) / Amber (#FEEBC8, #7B341E) / Red (#FED7D7, #9B2C2C) / Purple (#EDE9FE, #5B21B6) / Gray (#F3F4F6, #6B7280).
Text slot: 2-character initials string.
Component 12 — Timeline event
Frame: auto-layout horizontal, gap 16px, width fill, align flex-start. Left: dot column (auto-layout vertical, align centre, contains dot + optional connector line). Right: content column (auto-layout vertical, gap 2px).
Dot variants "state": Done (10px circle, optimal/text fill, optimal fill bg) / Active (10px, accent/blue fill) / Warning (10px, elevated/text fill, elevated fill) / Pending (10px, border/default border 1.5px, transparent fill, border-style dashed).
Connector line: 1px wide, height variable, border/default colour, sits below dot in dot column.
Content slots: timestamp (Label/10/Regular, text/secondary) + event name (Body/12/Medium) + detail text (Label/11/Regular, text/secondary) + optional tag pill (instance swap).
Component 13 — Laytime bar
Frame: auto-layout vertical, gap 4px, width fill.
Bar track: height 10px, background/secondary bg, radius/pill, overflow hidden. Contains horizontal bar segments as child frames — each segment is a coloured fill rectangle with percentage width.
Segment colour variants: Counting (chart/blue) / Dispatch (chart/green) / Demurrage (chart/red) / Deductible (chart/grey) / Remaining (#E5E7EB).
Below track: optional axis label row (Label/10/Regular, text/secondary, flex space-between).
Legend component: horizontal auto-layout, gap 12px. Legend item: 8×8px square (radius 2px, colour fill) + Label/11/Regular text. Colour variants same as segments.
Component 14 — Sidebar nav item
Frame: width fill, height 32px, horizontal auto-layout, padding 7px 14px, gap 8px, align centre.
Slots: optional Tabler icon (14px, inherits text colour) + label (Body/12/Regular or 500 on active).
Variants "state": Default (text/secondary, no bg, transparent left border 2px) / Hover (background/secondary, text/primary) / Active (background/secondary, accent/blue text, font 500, 2px solid left border accent/blue — set border-radius to 0 on left side).
Optional count pill slot on right (instance of badge component, gray variant).
Component 15 — Feed / alert card
Frame: auto-layout vertical, padding 8px 0 8px 12px, border-left 2px solid, no other border, radius 0 on left corners. Width fill.
Variants "type": Danger (border-left critical/text) / Warning (border-left elevated/text) / Info (border-left accent/blue) / Neutral (border-left border/default).
Slots: type label (Label/10/Uppercase, font 500, coloured per variant) + vessel/entity name (Body/12/Medium) + description (Label/11/Regular, text/secondary, line-height 1.4) + timestamp (Label/10/Regular, text/secondary).
Component 16 — Icon button
Frame: 30×30px, radius/md, border 0.5px border/default, background/primary, align centre.
Slot: Tabler outline icon 14px, text/secondary.
Variants "state": Default / Hover (background/secondary) / Active.
Optional "badge" boolean: adds 5×5px red dot absolutely positioned top-right at 6px 6px.
Component 17 — Mode toggle button (used in create shipment deal framework)
Frame: auto-layout vertical, padding 9px 8px, border 0.5px, radius/md, text-align centre, gap 3px, width fill.
Slots: icon (16px Tabler, text/secondary) + label (Body/11/Medium, text/primary) + sub (Label/10/Regular, text/secondary).
Variants "state": Default (border/default) / Hover (background/secondary) / Active (border accent/blue, background #EFF6FF, icon colour accent/blue).
Component 18 — Pipeline card (used in claims list Kanban)
Frame: auto-layout vertical, padding 10px 11px, border 0.5px, radius/md, gap 3px, width fill, cursor pointer.
Slots: vessel name (Body/12/Medium) + party (Label/11/Regular, text/secondary) + value (Body/13/Medium, coloured) + meta (Label/10/Regular, text/secondary) + optional progress bar (height 4px, radius/pill, coloured fill).
Variants "state": Default / Hover (border #93C5FD).

Variants "colour": Red / Amber / Green / Neutral (for value text colour).
Component 19 — Empty state
Frame: auto-layout vertical, align centre, padding 48px 24px, gap 12px, width fill.
Slots: icon (Tabler outline, 32px, text/tertiary) + title (Body/13/Medium, text/secondary) + description (Body/12/Regular, text/secondary, max-width 300px, text-align centre) + optional CTA button (instance of button component, primary variant).
Variants: Shipments empty / Claims empty / Templates empty / Entities empty / Search no results.
Component 20 — Skeleton loader row
Frame: horizontal auto-layout, padding 10px, gap 10px, width fill, height 40px.
Contains shimmer rectangles (background/secondary, radius/md) at approximate widths matching real data: 120px / 80px / 100px / 60px / 70px. No animation needed in Figma — static representation is sufficient for handoff.