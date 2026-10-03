---
name: Vite React cache after upgrades
description: A browser runtime mismatch can come from stale per-artifact Vite dependency optimization after React package versions change.
---

When React and ReactDOM resolve to matching versions but the Voice Studio preview still reports a runtime version mismatch, inspect the app's optimized Vite dependency cache before changing package versions again. The cache can continue serving old React or ReactDOM bundles after the lockfile and installed packages are updated.

**Why:** On 2026-10-03 the preview served cached React 19.1.0 bundles alongside the newly installed React 19.1.4 Clerk bundle. Clearing only the Voice Studio `.vite` cache and restarting its web workflow fixed the preview.

**How to apply:** Confirm `react` and `react-dom` resolve to the same version first. If the browser error still names an older version, remove only the artifact's generated `.vite` cache and restart that web workflow.