import re

def strip_js_comments_and_strings(code):
    # Strip multi-line comments
    code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
    # Strip single-line comments
    code = re.sub(r'//.*?\n', '\n', code)
    
    # Strip simple strings
    code = re.sub(r'"(?:[^"\\]|\\.)*"', '""', code)
    code = re.sub(r"'(?:[^'\\]|\\.)*'", "''", code)
    return code

code = open('frontend/js/pages/Dashboard.js', encoding='utf-8').read()
clean_code = strip_js_comments_and_strings(code)

braces = 0
for idx, char in enumerate(clean_code):
    if char == '{':
        braces += 1
    elif char == '}':
        braces -= 1
        if braces < 0:
            print(f"Mismatched closing brace at character index {idx} around text: {clean_code[idx-50:idx+50]}")
            break

print("Final brace count:", braces)
