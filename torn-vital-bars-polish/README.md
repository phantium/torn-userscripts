# Torn Vital Bars Polish

This folder contains the current userscript and the current captured preview for `Torn Vital Bars Polish`.

## Scope

The script aims to restyle:

- Energy
- Nerve
- Happy
- Life
- Chain

It keeps the work intentionally narrow:

- No automation
- No non-API Torn requests
- No page traversal
- No hidden-page behavior
- No gameplay actions

## What It Changes

- Polishes the visible `Energy`, `Nerve`, `Happy`, `Life`, and `Chain` rows only
- Keeps Torn's native sidebar structure and density
- Uses cleaner fills, restrained timer chips, and optional ticks
- Caps visible tick count so long rows stay readable

## Preview

<img src="./preview-current.png" alt="Torn Vital Bars Polish preview" width="180" />

Older concept-only previews were removed so the folder reflects the current live script appearance.

## Notes

This script is tied to Torn's current sidebar DOM structure and only targets confirmed visible vital rows.

## Install

Load `torn-vital-bars-polish.user.js` in Tampermonkey or Violentmonkey and test it on Torn while viewing the home/sidebar page.
