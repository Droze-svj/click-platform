import os
import re

# Paths to target
base_path = "/Volumes/CLICK/WHOP AI V3/client"
target_files = []

# Find all layout.tsx files
for root, dirs, files in os.walk(base_path):
    for file in files:
        if file == "layout.tsx" or file == "EditorRoot.tsx":
            target_files.append(os.path.join(root, file))

for file_path in target_files:
    with open(file_path, 'r') as f:
        content = f.read()

    # 1. Add the CSS import if not there
    if 'layout-autofit.css' not in content:
        content = 'import "../styles/layout-autofit.css";\n' + content

    # 2. Find the {children} and wrap it in our div
    # This looks for the pattern {children} and replaces it with the wrapped version
    if '{children}' in content and 'click-app-container' not in content:
        print(f"Wrapping content in: {file_path}")
        new_content = content.replace('{children}', '<div className="click-app-container">{children}</div>')
        
        with open(file_path, 'w') as f:
            f.write(new_content)
    else:
        print(f"Skipping (already wrapped or no children found): {file_path}")

print("✅ Auto-Wrap Complete. Layout is now Elastic.")
