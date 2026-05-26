# Project Method Point Cloud Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two-level switching so each railway project can show traditional algorithm and deep-learning PLY results.

**Architecture:** Keep the static page structure. `index.html` exposes project and method controls, `app.js` maps the active project/method pair to a PLY file and metadata, and `styles.css` styles the controls.

**Tech Stack:** HTML, CSS, JavaScript, Three.js, PLYLoader.

---

### Task 1: Add Semantic Controls

**Files:**
- Modify: `index.html`

- [ ] Replace the current two scene buttons with two control groups: one for project, one for method.
- [ ] Add a `metric-summary` field to describe the selected result.
- [ ] Update the module script query string to avoid stale browser caches.

### Task 2: Wire Four PLY Combinations

**Files:**
- Modify: `app.js`

- [ ] Replace the two-entry scene config with four project/method entries.
- [ ] Track `activeProject` and `activeMethod`.
- [ ] Update button handlers to set project or method independently.
- [ ] Load only the current combination's PLY file.
- [ ] Update metric text and label text when the combination changes.

### Task 3: Style Two-Level Switching

**Files:**
- Modify: `styles.css`

- [ ] Add styles for `control-group`, `control-label`, and `method-note`.
- [ ] Ensure buttons wrap cleanly on mobile.

### Task 4: Verify

**Files:**
- Verify: `index.html`, `app.js`, `styles.css`, `data/*.ply`

- [ ] Run static text checks for the four PLY paths and cache-busting query.
- [ ] Start or reuse the local static server.
- [ ] Use browser automation to click all four combinations and confirm PLY requests are 200.
- [ ] Check mobile viewport for no horizontal overflow.
