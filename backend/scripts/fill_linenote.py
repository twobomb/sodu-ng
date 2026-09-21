# -*- coding: utf-8 -*-
"""Заполняет шаблон строевой записки данными, сохраняя стили.
- шапка (1..6) не трогается;
- ячейки данных получают такой же шрифт/заливку/рамки как примерная строка 7;
- формат вывода — старый .xls.

Usage:
  python fill_linenote.py <template.xls> <data.json> <out.xls>

data.json:
{
  "start_row": 6,               # 0-based: Excel строка 7
  "rows": [
    {
      "values": {"1": "Южный ФО", "6": 5, ...},   # col -> value
      "red": [6, 7, 8, 9]       # пустые ячейки, закрашенные красным
    }
  ]
}
"""
import sys
import json
import xlrd
import xlwt
from xlutils.copy import copy

RED_STYLE = xlwt.easyxf(
    "pattern: pattern solid, fore_colour red; font: colour white",
    num_format_str="General",
)

_FILL_SOLID = 1


def _colour_index(idx):
    """Индекс цвета палитры (для xlwt нужен int, не имя)."""
    if idx is None:
        return 8
    i = idx & 0x3F
    return i if i != 64 else 8


def build_styles(rb, sh, row):
    """Стили по колонкам из строки-примера (row)."""
    ncols = sh.ncols
    styles = {}
    for c in range(ncols if ncols >= 0 else 0):
        styles[c] = _cell_style(rb, sh, row, c)
    return styles


def _cell_style(rb, sh, row, c):
    try:
        xf_index = sh.cell_xf_index(row, c)
    except Exception:
        return None
    xf = rb.xf_list[xf_index]
    st = xlwt.XFStyle()

    # шрифт
    font = rb.font_list[xf.font_index]
    f = xlwt.Font()
    f.name = font.name
    f.height = font.height
    f.bold = bool(font.weight >= 700)
    if font.italic:
        f.italic = True
    if font.underline_type > 0:
        f.underline = xlwt.Font.UNDERLINE_SINGLE
    try:
        f.colour_index = _colour_index(font.colour_index)
    except Exception:
        pass
    st.font = f

    # числовой формат
    if xf.format_key and xf.format_key in rb.format_map:
        st.num_format_str = rb.format_map[xf.format_key].format_str or "General"

    # выравнивание
    al = xlwt.Alignment()
    al.horz = xf.alignment.hor_align
    al.vert = xf.alignment.vert_align
    al.wrap = bool(xf.alignment.text_wrapped)
    st.alignment = al

    # заливка
    bg = xf.background
    if bg.fill_pattern:
        p = xlwt.Pattern()
        p.pattern = xlwt.Pattern.SOLID_PATTERN
        try:
            p.pattern_fore_colour = _colour_index(bg.pattern_colour_index)
            p.pattern_back_colour = _colour_index(bg.pattern_colour_index)
        except Exception:
            pass
        st.pattern = p

    # рамки
    b = xlwt.Borders()
    bo = xf.border
    if bo.top_line_style:
        b.top = bo.top_line_style
        b.top_colour = 8
    if bo.bottom_line_style:
        b.bottom = bo.bottom_line_style
        b.bottom_colour = 8
    if bo.left_line_style:
        b.left = bo.left_line_style
        b.left_colour = 8
    if bo.right_line_style:
        b.right = bo.right_line_style
        b.right_colour = 8
    st.borders = b
    return st


def main():
    template, datafile, out = sys.argv[1], sys.argv[2], sys.argv[3]
    with open(datafile, "r", encoding="utf-8") as f:
        data = json.load(f)

    rb = xlrd.open_workbook(template, formatting_info=True)
    sh = rb.sheet_by_index(0)
    styles = build_styles(rb, sh, 6)

    wb = copy(rb)
    ws = wb.get_sheet(0)

    start = data.get("start_row", 6)
    for i, row in enumerate(data.get("rows", [])):
        r = start + i
        st0 = styles.get(0)
        ws.write(r, 0, xlwt.Formula("TODAY()"), st0 or xlwt.Style.default_style)
        values = row.get("values", {})
        red = row.get("red", [])
        for k in values:
            c = int(k)
            ws.write(r, c, values[k], styles.get(c) or xlwt.Style.default_style)
        for k in red:
            ws.write(r, int(k), "", RED_STYLE)

    wb.save(out)
    print("OK")


if __name__ == "__main__":
    main()