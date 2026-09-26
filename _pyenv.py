# -*- coding: utf-8 -*-
import importlib
for m in ['xlwt', 'xlrd', 'xlutils', 'openpyxl', 'lxml']:
    try:
        mod = importlib.import_module(m)
        print(m, 'OK', getattr(mod, '__version__', '?'))
    except Exception as e:
        print(m, 'MISSING', type(e).__name__)