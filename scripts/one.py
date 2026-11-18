import sys, subprocess
from PIL import Image
# usage: one.py <item> <view> [zoom] [extra]  -> ref | single big render, 450 tall
item, view = sys.argv[1], sys.argv[2]
zoom = sys.argv[3] if len(sys.argv) > 3 else '1.4'
extra = sys.argv[4] if len(sys.argv) > 4 else ''
root = '/home/claude/farmhouse-editor'
out = f'{root}/shots/pv/{item}_one.png'
subprocess.run(['python3', f'{root}/scripts/pv.py', f'item={item}&views={view}&zoom={zoom}' + ('&' + extra if extra else ''), out, '900', '450'], capture_output=True)
b = Image.open(out).convert('RGB')
import os
ref = None
for e in ('png', 'jpg'):
    if os.path.exists(f'{root}/refs/{item}.{e}'): ref = f'{root}/refs/{item}.{e}'
if ref:
    a = Image.open(ref).convert('RGB'); a = a.resize((int(a.width * 450 / a.height), 450))
    o = Image.new('RGB', (a.width + b.width, 450)); o.paste(a, (0, 0)); o.paste(b, (a.width, 0)); o.save(f'{root}/shots/pv/{item}_cmp.png')
else:
    b.save(f'{root}/shots/pv/{item}_cmp.png')
print('ok')
