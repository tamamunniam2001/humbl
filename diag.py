import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'D:\VS Code\Humbl\app\kasir\page.js', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('Closing Modal')
print(repr(content[idx-5:idx+600]))
