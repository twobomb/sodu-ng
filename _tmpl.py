# -*- coding: utf-8 -*-
from openpyxl import load_workbook
wb = load_workbook('data/templates/template_call.xlsx')
ws = wb.active
for r in (4, 5, 6):
    c = ws.cell(r, 4)
    a = c.alignment
    print('row', r, 'D: wrap=%s vertical=%s font=%s sz=%s' % (
        a.wrap_text, a.vertical, getattr(c.font, 'name', None), getattr(c.font, 'sz', None)))
print('row 5 heights:', {r: ws.row_dimensions[r].height for r in range(4, 9)})