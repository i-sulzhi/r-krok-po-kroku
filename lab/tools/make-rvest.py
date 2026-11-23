"""Build lab/lab4-rvest.html, "Co widzi rvest" (D140).

The page shows one real page of the Sejm transcript, the oath of the Children's Ombudsman
(2023-12-20, statement 2), byte for byte from lab/tools/rvest-strona.html. The selector
runs in the browser on that same text, with querySelectorAll.

  python lab/tools/make-rvest.py
"""
import io
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(HERE)

raw = io.open(os.path.join(HERE, 'rvest-strona.html'), encoding='utf-8', newline='').read()
tpl = io.open(os.path.join(HERE, 'rvest-template.html'), encoding='utf-8').read()
# "</script>" inside the JSON string would end the page's script.
data = json.dumps(raw, ensure_ascii=False).replace('</', '<\\/')
out = tpl.replace('{{RAW}}', data)
assert '{{' not in out
io.open(os.path.join(LAB, 'lab4-rvest.html'), 'w', encoding='utf-8', newline='\n').write(out)
print('source bytes:', len(raw.encode('utf-8')), ' page bytes:', len(out.encode('utf-8')))
