#!/usr/bin/env python3
"""Package application code only. Never include runtime data, credentials or user uploads."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
output=root/'dist/connect-cell-hostinger.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output,'w',ZIP_DEFLATED) as z:
    for folder in ['app','seed','public']:
        for file in sorted((root/folder).rglob('*')):
            if not file.is_file() or file.is_symlink():continue
            rel=file.relative_to(root)
            if folder=='public' and rel.parts[1]=='uploads' and file.name!='.htaccess':continue
            target=rel
            z.write(file,str(target))
    for name in ['index.php','.htaccess','config.example.php','README.md','docs/VALIDACAO.md']:
        z.write(root/name,name)
print(output)
