# -*- coding: utf-8 -*-
import xlwt, inspect
print('xlwt file:', xlwt.__file__)
print('has RichText:', hasattr(xlwt, 'RichText'))
for name in ['RichText', 'Row', 'easyxf']:
    print(name, getattr(xlwt, name, None))
# try to find rich text support
import xlwt as x
src = inspect.getsourcefile(x) or ''
print('src:', src)
try:
    from xlwt import ComObj  # noqa
except Exception as e:
    print('ComObj', e)
import pkgutil, xlwt as xw
print([m.name for m in pkgutil.iter_modules(xw.__path__) if ''.join(m.name).lower() in ('richtext','row','worksheet') or 'rich' in m.name])