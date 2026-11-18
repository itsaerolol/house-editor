import sys, subprocess
subprocess.run(['/home/claude/farmhouse-editor/scripts/ensure_vite.sh'])
from playwright.sync_api import sync_playwright
# usage: mob.py WxH name|js|wait ...
W, H = map(int, sys.argv[1].split('x'))
steps = [a.split('|') for a in sys.argv[2:]]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': W, 'height': H}, is_mobile=True, has_touch=True, device_scale_factor=1)
    pg = ctx.new_page()
    logs = []
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.add_init_script("if(!sessionStorage.getItem('c')){localStorage.clear();sessionStorage.setItem('c','1')}")
    pg.goto('http://127.0.0.1:5199/?q=low')
    for st in steps:
        name, js = st[0], st[1]
        wait = int(st[2]) if len(st) > 2 else 3000
        if js:
            r = pg.evaluate(js)
            if r is not None: print(name, '->', r)
        pg.wait_for_timeout(wait)
        pg.screenshot(path=f'shots/{name}.png', timeout=120000)
    for l in logs[:10]: print(l[:300])
    b.close()
