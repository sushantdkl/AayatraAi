---
name: Aayatra Sales Engine
description: A calm, evidence-led sales operations workspace.
colors:
  forest-sidebar: "#152b27"
  forest-soft: "#203b35"
  action-green: "#0d6b56"
  action-green-hover: "#095944"
  action-green-soft: "#e5f3ed"
  ink: "#142724"
  muted: "#4f625b"
  line: "#e4eae6"
  canvas: "#f5f7f4"
  surface: "#ffffff"
  amber: "#a56110"
  red: "#a54337"
typography:
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    lineHeight: 1.45
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 680
rounded:
  small: "5px"
  field: "6px"
  button: "7px"
  card: "9px"
spacing:
  tight: "8px"
  control: "14px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.action-green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    height: "36px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.action-green-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.forest-sidebar}"
    rounded: "{rounded.button}"
    height: "36px"
    padding: "0 14px"
---

# Design System: Aayatra Sales Engine

## Overview

**Creative North Star: "The Quiet Sales Desk"**

This is an internal operating surface, not a promotional landing page. Dark forest navigation anchors the product; pale paper-like work areas keep lead evidence, decisions, and next actions easy to scan. The design favors a measured information density and clear status over spectacle.

**Key Characteristics:** restrained green, compact controls, explicit provenance and status, responsive data panels.

## Colors

Action green identifies primary actions and approved or active states. Forest is reserved for navigation; canvas and white separate work areas without heavy decoration. Amber and red communicate caution and errors, never product branding.

**The Evidence Color Rule.** A color must communicate navigation, action, or state; it must not imply a lead is verified when the underlying data is provisional.

## Typography

The UI uses the system sans-serif stack for reliable rendering and a practical, compact voice. Headlines are strong and concise; labels are small but legible, with secondary text muted rather than faint when it carries a decision.

## Layout

Desktop uses a fixed-width left sidebar (252px) and a flexible content area. The sidebar compresses to icons below 900px and becomes a horizontal navigation strip below 670px. Dashboard cards move from columns to a single vertical flow on narrow screens. Keep primary actions near the page heading and decision context near the record it affects.

## Elevation & Depth

The default surface is flat. White cards, faint borders, and the canvas color define hierarchy; hover lift is limited to interactive controls. Do not add large decorative shadows to ordinary data panels.

## Shapes

Controls and cards use small, gently rounded corners. Inputs, buttons, chips, and panels retain distinct but related radii from the token scale. Borders stay subtle so content carries the hierarchy.

## Components

Primary buttons are green with white text and a darker hover state. Secondary buttons are white with a green-gray border. Fields are white with a clear focus border and the global visible focus outline. Status badges use soft tonal fills and short uppercase labels. Navigation shows a distinct active state; mobile icon-only controls must retain accessible labels and titles. Cards use white surfaces with light borders, with no default shadow.

## Do's and Don'ts

### Do:

- **Do** show source, confidence, actor, and timing near research or stage decisions.
- **Do** preserve visible focus states and names for mobile icon controls.
- **Do** use restrained status color and plain-language copy.

### Don't:

- **Don't** make provisional fit or product suggestions look like verified facts.
- **Don't** use generic promotional gradients or decoration in core workflow screens.
- **Don't** hide a required next action inside a hover-only interaction.
