#!/usr/bin/env python3
"""Integration tests use only a temporary, isolated data directory; never production."""
import base64, http.cookiejar, json, os, secrets, shutil, subprocess, tempfile, time, urllib.request, urllib.error
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PHP=os.environ.get('PHP_BIN','php')
BASE='http://127.0.0.1:8081'
checks=0

def check(condition, message):
    global checks
    assert condition, message
    checks+=1
    print('PASS:',message,flush=True)

with tempfile.TemporaryDirectory(prefix='connect-tests-') as tmp:
    tmp=Path(tmp); data=tmp/'data'; config=tmp/'config.php'
    key=secrets.token_hex(32); password=secrets.token_urlsafe(24)
    config.write_text("<?php return ['environment'=>'development','installation_key'=>'"+key+"','data_dir'=>'"+str(data)+"'];")
    env={**os.environ,'CONNECT_CONFIG_FILE':str(config),'CONNECT_DATA_DIR':str(data)}
    log=open(tmp/'server.log','w')
    def start():
        p=subprocess.Popen([PHP,'-d','upload_max_filesize=5M','-d','post_max_size=6M','-S','127.0.0.1:8081','-t',str(ROOT/'public'),str(ROOT/'scripts/router.php')],env=env,stdout=log,stderr=log)
        for _ in range(100):
            try:
                urllib.request.urlopen(BASE+'/api/index.php',timeout=1).read();return p
            except Exception:
                if p.poll() is not None: raise RuntimeError('PHP server did not start')
                time.sleep(.05)
        raise RuntimeError('PHP readiness timeout')
    jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar));token=''
    def req(action, body=None, csrf=True, raw=None, content=None):
        headers={}
        payload=json.dumps(body).encode() if body is not None else raw
        if payload is not None:headers['Content-Type']=content or 'application/json'
        if csrf and token: headers['X-CSRF-Token']=token
        request=urllib.request.Request(BASE+'/api/index.php?action='+action,data=payload,headers=headers)
        try:r=client.open(request)
        except urllib.error.HTTPError as e:r=e
        payload=r.read()
        return r.code,json.loads(payload),r.headers
    def mutate(action,**kwargs):
        revision=req('store')[1]['revision']
        return req(action,{'revision':revision,**kwargs})
    uploads=[]
    proc=start()
    try:
        check(req('catalog')[0]==200,'Public catalog loads')
        check(req('store')[0]==401,'Unauthenticated catalog management rejected')
        check(req('backup')[0]==401,'Unauthenticated backup rejected')
        status,s,h=req('session'); token=s['csrf']
        check(not s['installed'] and s['configured'],'Installation state from private configuration')
        check(any('HttpOnly' in c._rest and c._rest.get('SameSite') == 'Strict' for c in jar),'Session cookie hardening')
        check(req('setup',{'key':key,'password':password},csrf=False)[0]==403,'Setup requires CSRF')
        check(req('setup',{'key':'incorrect','password':password})[0]==403,'Wrong installation key rejected')
        status,res,_=req('setup',{'key':key,'password':password});token=res['csrf']
        check(status==200,'Administrator created')
        auth=json.loads((data/'auth.json').read_text());check(password not in json.dumps(auth) and auth['hash'].startswith('$'),'Only password hash persisted')
        check(req('setup',{'key':key,'password':password})[0]==409,'Installation cannot overwrite existing administrator')
        check(req('product-save',{},csrf=False)[0]==403,'Administrative mutations require CSRF')
        for path in ['/storage/store.json','/config.local.php','/app/bootstrap.php','/seed/demo.json']:
            try:code=client.open(BASE+path).code
            except urllib.error.HTTPError as e:code=e.code
            check(code==404,'Private path inaccessible: '+path)
        p={'id':'qa-product','name':'Teste <script>alert(1)</script>','description':'Descrição & detalhes','price':10000,'salePrice':8000,'category':'Mobilidade elétrica','image':'/assets/scooter-cinza.webp','gallery':[],'variations':[{'name':'Cor','options':['Preto','Branco']}],'active':True,'available':True,'featured':True,'demo':False,'order':-1}
        check(mutate('product-save',product=p)[0]==200,'Product creation')
        oldrev=req('store')[1]['revision'];p['description']='Descrição editada';p['price']=12000
        check(mutate('product-save',product=p)[0]==200,'Price and description editing')
        check(req('product-delete',{'id':p['id'],'revision':oldrev})[0]==409,'Stale revision cannot overwrite concurrent edits')
        check(mutate('product-save',product={**p,'price':-1})[0]==422,'Negative price rejected')
        check(mutate('product-save',product={**p,'image':'javascript:alert(1)'})[0]==422,'Unsafe image path rejected')
        check(mutate('categories-save',categories=['Nova categoria'])[0]==422,'In-use category cannot be removed')
        check(mutate('categories-save',categories=req('store')[1]['categories']+['Teste'])[0]==200,'Category creation')
        quote={'items':[{'id':p['id'],'quantity':2,'variations':{'Cor':'Preto'},'price':1}],'name':'João & Ana','notes':'Retirar às 16h?'}
        status,q,_=req('quote',quote)
        check(status==200 and q['total']==16000 and 'R$ 160,00' in q['message'],'Checkout recalculates current server prices')
        check('João & Ana' in q['message'] and 'Cor: Preto' in q['message'] and '%26' in q['url'],'WhatsApp names, variation, accents and encoding')
        check(req('quote',{'items':[]})[0]==422,'Empty checkout rejected')
        check(req('quote',{'items':[{'id':p['id'],'quantity':2,'variations':{}}]})[0]==422,'Required variation enforced')
        p['active']=False;mutate('product-save',product=p)
        check(not any(x['id']==p['id'] for x in req('catalog')[1]['products']),'Hidden products excluded from storefront')
        check(req('quote',quote)[0]==409,'Hidden products cannot be ordered')
        p['active']=True;p['available']=False;mutate('product-save',product=p)
        check(req('quote',quote)[0]==409,'Unavailable products cannot be ordered')
        p['available']=True;mutate('product-save',product=p)
        settings=req('store')[1]['settings'];saved_settings=settings.copy();settings['whatsapp']='';mutate('settings-save',settings=settings)
        check(req('quote',quote)[0]==422,'Missing WhatsApp blocks checkout')
        settings.update({'whatsapp':'5511999999999','name':'Loja de teste','campaign':'Campanha de teste'})
        check(mutate('settings-save',settings=settings)[0]==200,'Store identity and campaign editing')
        check(req('quote',quote)[1]['url'].startswith('https://wa.me/5511999999999?'),'Checkout uses configured number')
        mutate('settings-save',settings=saved_settings)
        def upload(blob,name='photo.png',mime='image/png'):
            boundary='test'+secrets.token_hex(16)
            body=(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n').encode()+blob+f'\r\n--{boundary}--\r\n'.encode()
            return req('upload',raw=body,content='multipart/form-data; boundary='+boundary)
        check(upload(b'<svg onload="alert(1)"></svg>','x.svg','image/svg+xml')[0]==422,'SVG upload rejected')
        check(upload(b'<?php echo "unsafe"; ?>')[0]==422,'Disguised script upload rejected')
        check(upload(b'0'*(5*1024*1024+1))[0]==422,'Oversized image rejected')
        status,u,_=upload((ROOT/'public/assets/logo.webp').read_bytes(),'evil.php','image/webp');uploads.append(u.get('path',''))
        check(status==200 and u['path'].endswith('.webp'),'Raster upload renamed and re-encoded')
        r=client.open(BASE+u['path']);check(r.code==200 and r.headers.get_content_type()=='image/webp','Uploaded image served correctly')
        p['image']=u['path'];p['gallery']=['/assets/scooter-branca.webp'];mutate('product-save',product=p)
        check(req('store')[1]['products'][-1]['image']==u['path'],'Uploaded image persisted with product')
        check(mutate('product-delete',id=p['id'])[0]==200,'Product deletion')
        check(not any(x['id']==p['id'] for x in req('store')[1]['products']),'Deleted product stays absent')
        check(req('backup')[0]==200 and 'attachment' in req('backup')[2]['Content-Disposition'],'Authenticated catalog export')
        backups=list((data/'backups').glob('*.json'));check(len(backups)>0 and all(json.loads(f.read_text()) for f in backups),'Valid automatic JSON backups')
        contents=(data/'store.json').read_bytes();proc.terminate();proc.wait();proc=start()
        check((data/'store.json').read_bytes()==contents,'Catalog survives server restart without reseeding')
        (data/'store.json').write_text('{broken')
        check(req('catalog')[0]==500 and (data/'store.json').read_text()=='{broken','Corruption fails closed without replacing production data')
        (data/'store.json').write_bytes(contents)
        check(req('logout',{})[0]==200 and req('store')[0]==401,'Logout revokes authenticated access')
        token=req('session')[1]['csrf'];check(req('login',{'password':'incorrect'})[0]==401,'Incorrect login rejected')
        status,res,_=req('login',{'password':password});token=res['csrf'];check(status==200,'Login with configured password')
        child_env={**os.environ,'TEST_BASE':BASE,'TEST_PASSWORD':password,'TEST_DATA':str(data)}
        subprocess.run(['node',str(ROOT/'tests/browser.cjs')],env=child_env,cwd=ROOT,check=True)
        # Simulate an installation upgrading from a pre-iPhone catalog.
        legacy = json.loads((ROOT/'seed/demo.json').read_text())
        legacy['revision'] = 42
        legacy['products'].pop(0)
        legacy['settings']['campaign'] = 'Campanha local'
        custom = {**legacy['products'][0], 'id':'local-phone', 'name':'iPhone 17', 'price':100000, 'active':False}
        legacy['products'].append(custom)
        (data/'store.json').write_text(json.dumps(legacy))
        upgraded = req('store')[1]
        check(upgraded['revision'] == 43 and upgraded['settings'] == legacy['settings']
              and upgraded['products'] == legacy['products'] + [p for p in upgraded['products'] if p['id'] in ('iphone-14','iphone-15')]
              and len(upgraded['products']) == len(legacy['products']) + 2,
              'Upgrade preserves catalog edits and adds only missing iPhones')
        check(mutate('product-delete', id='iphone-14')[0] == 200
              and not any(p['id'] == 'iphone-14' for p in req('catalog')[1]['products']),
              'Deleting an imported phone is permanent across catalog reads')
        check(req('password',{'current':'wrong','password':secrets.token_urlsafe(24)})[0]==403,'Password change requires current password')
        check(req('password',{'current':password,'password':secrets.token_urlsafe(24)})[0]==200,'Password change persists a new secure hash')
        check(req('store')[0]==200,'Current session remains valid after password change')
        req('logout',{});token=req('session')[1]['csrf']
        for _ in range(10):status,_,_=req('login',{'password':'wrong-password'})
        check(status==401,'First ten login attempts receive credential errors')
        check(req('login',{'password':'wrong-password'})[0]==429,'Repeated login attempts rate limited')
        proc.terminate();proc.wait()
        config.write_text(config.read_text().replace("'development'","'production'"))
        proc=subprocess.Popen([PHP,'-S','127.0.0.1:8081','-t',str(ROOT/'public'),str(ROOT/'scripts/router.php')],env=env,stdout=log,stderr=log)
        for _ in range(50):
            try:
                client.open(BASE);time.sleep(.05)
            except urllib.error.HTTPError as e:
                check(e.code==403,'Production refuses plain HTTP');break
            except urllib.error.URLError:time.sleep(.05)
        else:raise AssertionError('Production HTTPS test did not complete')
        print(f'PASS: {checks} backend integration checks',flush=True)
    finally:
        proc.terminate();proc.wait();log.close()
        # Delete only uploads created by these isolated tests.
        for path in uploads:
            if path.startswith('/uploads/'):(ROOT/'public'/path.lstrip('/')).unlink(missing_ok=True)
