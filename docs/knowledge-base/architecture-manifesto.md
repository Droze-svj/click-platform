# Whop AI V3: Technical Manifesto

## 1. The Elastic Grid (UI)
- All layouts must use CSS Grid with named areas.
- No 'absolute' positioning for global layout elements.
- The 'click-shell' is the root container (100vh/100vw).

## 2. Memory Bridge (Logic)
- Data must flow through centralized 'Bridge' handlers.
- Minimize state updates in high-frequency video components.
- Use 'useMemo' and 'useCallback' aggressively to save CPU cycles on this 8GB device.

## 3. The Digital Twin (Sync)
- Code must reflect the "Creator's Intent" - clean, professional, and dark-mode native.
- Component names must follow the 'Click' prefix (e.g., ClickSidebar, ClickPlayer).

## 4. Hardware Safety
- If a file exceeds 500 lines, split it into modular sub-components.
- Large assets must be lazy-loaded.
