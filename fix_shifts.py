import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'D:\VS Code\Humbl\app\kasir\page.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the first "Closing Modal" comment (the clean one)
start = content.find('// \u2500\u2500 Closing Modal \u2500\u2500\n')
print(f"Start of block: {start}")

# Find the real clean SHIFTS (uses \n not \\r\\n)
# It appears after the escaped block: ]\r\n\r\n or ]\n\n
# Look for "const SHIFTS = [\n  { key: 'SHIFT_1'" with literal newlines
real_shifts_marker = "const SHIFTS = [\n  { key: 'SHIFT_1'"
pos = content.find(real_shifts_marker)
print(f"Real SHIFTS marker at: {pos}")

# There might be two - find the second one (after the escaped one)
pos2 = content.find(real_shifts_marker, pos + 1)
print(f"Second real SHIFTS marker at: {pos2}")

if start != -1:
    if pos2 != -1:
        # Remove from start up to (not including) the second real SHIFTS
        content = content[:start] + '// \u2500\u2500 Closing Modal \u2500\u2500\n' + content[pos2:]
        print("Fixed: kept only clean comment + second real SHIFTS")
    elif pos != -1:
        content = content[:start] + '// \u2500\u2500 Closing Modal \u2500\u2500\n' + content[pos:]
        print("Fixed: kept only clean comment + real SHIFTS")

# Also fix the extra blank line inside ClosingModal after the fmt line
# "function ClosingModal(...) {\n\n  const fmt" -> "function ClosingModal(...) {\n  const fmt"
content = content.replace(
    "function ClosingModal({ orders, onClose, onSaved }) {\n\n  const fmt",
    "function ClosingModal({ orders, onClose, onSaved }) {\n  const fmt"
)

with open(r'D:\VS Code\Humbl\app\kasir\page.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done. File size: {len(content)}")

# Verify
with open(r'D:\VS Code\Humbl\app\kasir\page.js', 'r', encoding='utf-8') as f:
    c = f.read()
idx = c.find('Closing Modal')
print("\nVerification:")
print(repr(c[idx-5:idx+400]))
