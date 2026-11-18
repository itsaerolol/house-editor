import sys, json, time
from playwright.sync_api import sync_playwright

# usage: shot.py out.png [mode] [extra js]
out = sys.argv[1]
mode = sys.argv[2] if len(sys.argv) > 2 else 'iso'
js = sys.argv[3] if len(sys.argv) > 3 else ''
W, H = (1500, 900)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    logs = []
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}'))
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.goto('file:///home/claude/farmhouse-editor/dist/index.html')
    pg.wait_for_timeout(1500)
    pg.evaluate("localStorage.clear()")
    if js:
        pg.evaluate(js)
    pg.keyboard.press({'front':'1','back':'2','left':'3','right':'4','top':'5','bottom':'6','iso':'7','plan':'8','persp':'9'}.get(mode,'7'))
    pg.wait_for_timeout(int(sys.argv[4]) if len(sys.argv) > 4 else 6000)
    pg.screenshot(path=out)
    for l in logs[:25]:
        print(l[:300])
    b.close()
