#!/usr/bin/env python3
"""Test shipped .htaccess rules on real Apache, with a throwaway document root."""
import os, pathlib, shutil, ssl, subprocess, tempfile, time, urllib.request, urllib.error
root=pathlib.Path(__file__).resolve().parents[1]
httpd=os.environ.get('HTTPD_BIN','apache2');modules=os.environ.get('HTTPD_MODULE_DIR','/usr/lib/apache2/modules')
with tempfile.TemporaryDirectory(prefix='connect-apache-') as td:
    t=pathlib.Path(td);public=t/'public';public.mkdir();(public/'uploads').mkdir()
    shutil.copy(root/'public/.htaccess',public/'.htaccess');shutil.copy(root/'public/uploads/.htaccess',public/'uploads/.htaccess')
    (public/'index.html').write_text('public');(public/'secret.json').write_text('private');(public/'uploads/probe.php').write_text('<?php echo "must not execute";');(public/'uploads/probe.PHP').write_text('private');(public/'uploads/photo.webp').write_bytes((root/'public/assets/logo.webp').read_bytes())
    subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout',str(t/'key.pem'),'-out',str(t/'cert.pem'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    mods=['mpm_event','authz_core','authz_host','dir','mime','rewrite','headers','socache_shmcb','ssl']
    conf=f'ServerRoot "{t}"\nServerName localhost\nListen 127.0.0.1:18080\nListen 127.0.0.1:18443\nPidFile "{t}/apache.pid"\nErrorLog "{t}/error.log"\n'
    conf+='\n'.join(f'LoadModule {m}_module "{modules}/mod_{m}.so"' for m in mods)+'\n'
    conf+=f'TypesConfig /etc/mime.types\nDocumentRoot "{public}"\n<Directory "{public}">\nAllowOverride All\nRequire all granted\n</Directory>\n<VirtualHost 127.0.0.1:18443>\nSSLEngine on\nSSLCertificateFile "{t}/cert.pem"\nSSLCertificateKeyFile "{t}/key.pem"\nDocumentRoot "{public}"\n</VirtualHost>\n'
    (t/'httpd.conf').write_text(conf)
    subprocess.run([httpd,'-t','-f',str(t/'httpd.conf')],check=True)
    p=subprocess.Popen([httpd,'-X','-f',str(t/'httpd.conf')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        context=ssl.create_default_context(cafile=str(t/'cert.pem'))
        for _ in range(80):
            try:urllib.request.urlopen('https://localhost:18443/index.html',context=context);break
            except urllib.error.URLError:time.sleep(.05)
        else:raise RuntimeError('Apache did not start: '+(t/'error.log').read_text())
        for url,expected in [('/secret.json',403),('/uploads/probe.php',403),('/uploads/probe.PHP',403),('/uploads/.htaccess',403),('/uploads/',403),('/storage/store.json',404),('/config.local.php',404),('/uploads/photo.webp',200)]:
            try:r=urllib.request.urlopen('https://localhost:18443'+url,context=context)
            except urllib.error.HTTPError as e:r=e
            assert r.code==expected,(url,r.code)
            assert r.headers.get('X-Content-Type-Options')=='nosniff'
            print('PASS Apache:',url,expected)
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self,*args,**kwargs):return None
        try:urllib.request.build_opener(NoRedirect()).open('http://localhost:18080/index.html')
        except urllib.error.HTTPError as e:
            assert e.code==301 and e.headers['Location'].startswith('https://')
            print('PASS Apache: HTTP redirects to HTTPS')
        else:raise AssertionError('HTTP did not redirect')
        print('PASS: 9 Apache rule checks, TLS certificate explicitly trusted')
    finally:p.terminate();p.wait()
