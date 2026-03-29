---
name: rational-coder
description: Enforces a 'Think-Verify-Execute' loop for complex logic.
---
# Rational Coding Protocol
Before making any file edits, you MUST follow these three steps:
1. **The Plan**: List the specific lines of code you will change and WHY.
2. **The Risk Check**: Identify one way this change could break the app (e.g., "This might break the React state in ClickDebugPanel").
3. **The Self-Correction**: Adjust your plan to avoid that risk.
4. **The Verification**: After writing the file, use the 'shell' tool to run a syntax check (e.g., 'tsc' or 'npm run lint').
