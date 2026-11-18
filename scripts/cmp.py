import sys, subprocess, os
from PIL import Image, ImageDraw
# usage: cmp.py <item> "<extra query>" [views]  -> renders preview and composes ref | render
item = sys.argv[1]
extra = sys.argv[2] if len(sys.argv) > 2 else ''
views = sys.argv[3] if len(sys.argv) > 3 else 'hero,front,side,top'
root = '/home/claude/farmhouse-editor'
pv = f'{root}/shots/pv/{item}.png'
q = f'item={item}&views={views}' + (('&' + extra) if extra else '')
subprocess.run(['python3', f'{root}/scripts/pv.py', q, pv, '1100', '700'], check=False)
r = Image.open(pv).convert('RGB')
H = r.height
refp = None
for ext in ('png', 'jpg'):
    if os.path.exists(f'{root}/refs/{item}.{ext}'): refp = f'{root}/refs/{item}.{ext}'
if refp:
    ref = Image.open(refp).convert('RGB')
    ref = ref.resize((int(ref.width * H / ref.height), H))
    out = Image.new('RGB', (ref.width + 6 + r.width, H), (40, 40, 40))
    out.paste(ref, (0, 0)); out.paste(r, (ref.width + 6, 0))
    ImageDraw.Draw(out).text((8, H - 18), 'REFERENCE', fill=(255, 80, 40))
else:
    out = r
out.save(f'{root}/shots/pv/{item}_cmp.png')
print(f'{root}/shots/pv/{item}_cmp.png', out.size)
