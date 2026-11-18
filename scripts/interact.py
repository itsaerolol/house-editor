import sys, json
from playwright.sync_api import sync_playwright
W, H = (1500, 900)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': W, 'height': H})
    logs = []
    pg.on('console', lambda m: logs.append(f'[{m.type}] {m.text}') if m.type in ('error',) else None)
    pg.on('pageerror', lambda e: logs.append(f'[pageerror] {e}'))
    pg.goto('file:///home/claude/farmhouse-editor/dist/index.html')
    pg.wait_for_timeout(1200)
    pg.evaluate("localStorage.clear()")
    pg.evaluate("__store.getState().setView({mode:'plan',quality:'low',activeLevelId:'L1',showDimensions:false})")
    pg.wait_for_timeout(3000)
    pg.screenshot(path='shots/i0_plan.png', timeout=120000)
    # project a world point to screen
    proj = """(pt)=>{const s=__three.get();const v=new s.camera.position.constructor(pt[0],pt[1],pt[2]).project(s.camera);const r=s.gl.domElement.getBoundingClientRect();return [r.left+(v.x+1)/2*r.width, r.top+(1-v.y)/2*r.height]}"""
    def scr(x,y,z): return pg.evaluate(proj, [x,y,z])
    # 1. click a sofa to select it
    sofa = pg.evaluate("(()=>{const f=Object.values(__store.getState().hist.project.furniture).find(f=>/sofa/i.test(f.name)&&f.levelId==='L1');return [f.id,f.position.x,f.position.z,f.size.w]})()")
    print('sofa', sofa)
    x,y = scr(sofa[1], 3.4, sofa[2])
    pg.mouse.click(x,y)
    pg.wait_for_timeout(600)
    print('selected ->', pg.evaluate("JSON.stringify(__store.getState().selection)"))
    # 2. drag it 1 m in x
    pos0 = pg.evaluate(f"JSON.stringify(__store.getState().hist.project.furniture['{sofa[0]}'].position)")
    x2,y2 = scr(sofa[1]-1.0, 3.4, sofa[2])
    pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move((x+x2)/2,(y+y2)/2, steps=4); pg.mouse.move(x2,y2, steps=4); pg.mouse.up()
    pg.wait_for_timeout(500)
    pos1 = pg.evaluate(f"JSON.stringify(__store.getState().hist.project.furniture['{sofa[0]}'].position)")
    print('drag', pos0, '->', pos1, 'undo depth', pg.evaluate("__store.getState().hist.past.length"))
    pg.screenshot(path='shots/i1_drag.png', timeout=120000)
    # 3. undo/redo
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(300)
    print('undo ->', pg.evaluate(f"JSON.stringify(__store.getState().hist.project.furniture['{sofa[0]}'].position)"))
    pg.keyboard.press('Control+Shift+z'); pg.wait_for_timeout(300)
    print('redo ->', pg.evaluate(f"JSON.stringify(__store.getState().hist.project.furniture['{sofa[0]}'].position)"))
    # 4. draw a wall in an empty garage-side spot using the wall tool
    pg.evaluate("__store.getState().select(null); __store.getState().setTool('wall')")
    walls0 = pg.evaluate("Object.keys(__store.getState().hist.project.walls).length")
    a = scr(-3.0, 3.05, -2.0); c = scr(-3.0, 3.05, -5.0)
    pg.mouse.move(*a); pg.wait_for_timeout(200); pg.mouse.click(*a); pg.mouse.move(*c); pg.wait_for_timeout(200)
    pg.screenshot(path='shots/i2_walldraft.png', timeout=120000)
    pg.mouse.click(*c); pg.wait_for_timeout(300)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    print('walls', walls0, '->', pg.evaluate("Object.keys(__store.getState().hist.project.walls).length"), 'tool', pg.evaluate("__store.getState().tool"))
    # 5. place a window on the wall just drawn via window tool
    pg.evaluate("__store.getState().setTool('window')")
    mid = scr(-3.0, 4.2, -3.5)
    pg.mouse.move(*mid); pg.wait_for_timeout(400)
    pg.screenshot(path='shots/i3_window_preview.png', timeout=120000)
    ops0 = pg.evaluate("Object.keys(__store.getState().hist.project.openings).length")
    pg.mouse.click(*mid); pg.wait_for_timeout(400)
    print('openings', ops0, '->', pg.evaluate("Object.keys(__store.getState().hist.project.openings).length"))
    # 6. place furniture from the catalog
    pg.evaluate("__store.getState().startPlacing('armchair')")
    f0 = pg.evaluate("Object.keys(__store.getState().hist.project.furniture).length")
    t = scr(-6.0, 3.05, -3.0)
    pg.mouse.move(*t); pg.wait_for_timeout(300)
    pg.screenshot(path='shots/i4_place_preview.png', timeout=120000)
    pg.keyboard.press('r'); pg.wait_for_timeout(200)
    pg.mouse.click(*t); pg.wait_for_timeout(400)
    print('furniture', f0, '->', pg.evaluate("Object.keys(__store.getState().hist.project.furniture).length"), 'tool', pg.evaluate("__store.getState().tool"))
    # 7. escape cancels placement
    pg.evaluate("__store.getState().startPlacing('armchair')"); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    print('esc placing ->', pg.evaluate("String(__store.getState().placing)"), pg.evaluate("__store.getState().tool"))
    for l in logs[:20]: print(l[:300])
    b.close()
