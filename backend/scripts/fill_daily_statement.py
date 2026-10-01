# -*- coding: utf-8 -*-
"""Заполняет шаблон «Суточная ведомость» (daily_statement.xls).

Шапка (строки 1-4) и подвал (последние строки, начиная со строки 7) берутся из
шаблона вместе со стилями и объединениями. Между ними выводятся группы вызовов:
строка-заголовок группы (объединена A:H) и по одной строке на каждый вызов.
Высота строк данных считается по самому «высокому» столбцу (адрес/описание/силы).

Работаем в формате .xls (xlrd + xlwt), как в fill_linenote.py — это стабильно
открывается в Excel без «восстановления файла».

Usage:
  python fill_daily_statement.py <template.xls> <data.json> <out.xls>

data.json:
{
  "date": "17.09.2026",
  "footer": {"dolzhnost": "Начальник караула", "zvanie": "капитан", "fio": "Иванов И.И."},
  "groups": [
    {"title": "Пожар: 5", "calls": [
      {"number": 1, "date": "17.09.2026", "time": "00:09",
       "addr_ob": "ул. Лесная, 15\\nЖилой дом", "description": "...",
       "forces": "Вода\\nАЦ:4", "localization": "17.09.2026 01:00",
       "liquidation": "17.09.2026 02:30"}
    ]}
  ]
}
"""
import sys
import json
import math
import xlrd
import xlwt

HEADER_ROWS = 4      # строки 1..4 — шапка
GROUP_SRC = 4        # индекс строки-заголовка группы в шаблоне (строка 5)
DATA_SRC = 5         # индекс строки данных в шаблоне (строка 6)
FOOTER_START = 6     # индекс первой строки подвала в шаблоне (строка 7)
MAXC = 8             # колонки A..H

_COL_D, _COL_E, _COL_F = 3, 4, 5  # колонки для оценки высоты строки


def _colour_index(idx):
    """Индекс цвета палитры для xlwt (автоматический/системный → чёрный)."""
    try:
        i = int(idx)
    except Exception:
        return 8
    if i < 0 or i > 63:
        return 8
    return i


def xf_to_style(rb, xf):
    """Преобразует формат ячейки xlrd (xf) в xlwt.XFStyle."""
    st = xlwt.XFStyle()

    # Шрифт
    src = rb.font_list[xf.font_index]
    f = xlwt.Font()
    f.name = src.name
    f.height = src.height
    f.bold = bool(src.weight >= 700)
    f.italic = bool(src.italic)
    if getattr(src, 'underline_type', 0):
        f.underline = xlwt.Font.UNDERLINE_SINGLE
    f.colour_index = _colour_index(src.colour_index)
    st.font = f

    # Выравнивание
    al = xlwt.Alignment()
    al.horz = xf.alignment.hor_align
    al.vert = xf.alignment.vert_align
    al.wrap = bool(xf.alignment.text_wrapped)
    st.alignment = al

    # Рамки
    bo = xf.border
    b = xlwt.Borders()
    if bo.top_line_style:
        b.top = bo.top_line_style
        b.top_colour = _colour_index(bo.top_colour_index)
    if bo.bottom_line_style:
        b.bottom = bo.bottom_line_style
        b.bottom_colour = _colour_index(bo.bottom_colour_index)
    if bo.left_line_style:
        b.left = bo.left_line_style
        b.left_colour = _colour_index(bo.left_colour_index)
    if bo.right_line_style:
        b.right = bo.right_line_style
        b.right_colour = _colour_index(bo.right_colour_index)
    st.borders = b

    # Заливка
    bg = xf.background
    if bg.fill_pattern:
        p = xlwt.Pattern()
        p.pattern = xlwt.Pattern.SOLID_PATTERN
        p.pattern_fore_colour = _colour_index(bg.pattern_colour_index)
        p.pattern_back_colour = _colour_index(bg.pattern_colour_index)
        st.pattern = p

    # Числовой формат
    fmt = ''
    if xf.format_key and xf.format_key in rb.format_map:
        fmt = rb.format_map[xf.format_key].format_str or ''
    if fmt and fmt != 'General':
        st.num_format_str = fmt
    return st


def cell_lines(text, width_chars):
    """Оценка числа строк, которое займёт текст в колонке заданной ширины."""
    if text is None or text == '':
        return 1
    cpl = max(6, int(width_chars))
    total = 0
    for seg in str(text).split('\n'):
        total += max(1, int(math.ceil(len(seg) / float(cpl))))
    return total


def main():
    template, datafile, out = sys.argv[1], sys.argv[2], sys.argv[3]
    with open(datafile, 'r', encoding='utf-8') as fh:
        data = json.load(fh)

    rb = xlrd.open_workbook(template, formatting_info=True)
    sh = rb.sheet_by_index(0)

    # --- таблица объединений ---
    anchors = {}     # (r, c) -> (r2, c2) — левый верхний угол объединения
    covered = set()  # ячейки, перекрытые объединением (кроме якоря)
    for (rlo, rhi, clo, chi) in sh.merged_cells:
        anchors[(rlo, clo)] = (rhi - 1, chi - 1)
        for rr in range(rlo, rhi):
            for cc in range(clo, chi):
                if (rr, cc) != (rlo, clo):
                    covered.add((rr, cc))

    style_cache = {}

    def style_of(r, c):
        xfx = sh.cell_xf_index(r, c)
        st = style_cache.get(xfx)
        if st is None:
            st = xf_to_style(rb, rb.xf_list[xfx])
            style_cache[xfx] = st
        return st

    def height_of(r):
        rd = sh.rowinfo_map.get(r)
        return rd.height if rd is not None and rd.height else None

    def width_of(c, default=10):
        return (sh.colinfo_map[c].width / 256.0) if c in sh.colinfo_map else default

    # --- новый рабочий лист ---
    wb = xlwt.Workbook()
    ws = wb.add_sheet(sh.name[:31] or 'Ведомость')
    for c in range(MAXC):
        if c in sh.colinfo_map:
            ws.col(c).width = sh.colinfo_map[c].width

    date_str = data.get('date') or ''
    footer = data.get('footer') or {}

    def set_height(row, twips):
        if twips:
            ws.row(row).height = int(twips)
            ws.row(row).height_mismatch = 1

    # --- ШАПКА (1..4) ---
    for tr in range(HEADER_ROWS):
        for c in range(MAXC):
            if (tr, c) in covered:
                continue
            val = sh.cell_value(tr, c)
            if isinstance(val, str) and '%ТЕК_ДАТА%' in val:
                val = val.replace('%ТЕК_ДАТА%', date_str)
            st = style_of(tr, c)
            if (tr, c) in anchors:
                r2, c2 = anchors[(tr, c)]
                ws.write_merge(tr, r2, c, c2, val, st)
            else:
                ws.write(tr, c, val, st)
        set_height(tr, height_of(tr))

    # --- ГРУППЫ И СТРОКИ ВЫЗОВОВ ---
    group_style = style_of(GROUP_SRC, 0)
    group_h = height_of(GROUP_SRC) or 300
    data_styles = [style_of(DATA_SRC, c) for c in range(MAXC)]

    d_w = width_of(_COL_D, 29)
    e_w = width_of(_COL_E, 55)
    f_w = width_of(_COL_F, 15)

    row = HEADER_ROWS
    for grp in data.get('groups') or []:
        ws.write_merge(row, row, 0, MAXC - 1, grp.get('title') or '', group_style)
        set_height(row, group_h)
        row += 1
        for call in grp.get('calls') or []:
            ws.write(row, 0, call.get('number'), data_styles[0])
            ws.write(row, 1, call.get('date') or '', data_styles[1])
            ws.write(row, 2, call.get('time') or '', data_styles[2])
            ws.write(row, 3, call.get('addr_ob') or '', data_styles[3])
            ws.write(row, 4, call.get('description') or '', data_styles[4])
            ws.write(row, 5, call.get('forces') or '', data_styles[5])
            ws.write(row, 6, call.get('localization') or '', data_styles[6])
            ws.write(row, 7, call.get('liquidation') or '', data_styles[7])
            lines = max(
                cell_lines(call.get('addr_ob'), d_w),
                cell_lines(call.get('description'), e_w),
                cell_lines(call.get('forces'), f_w),
                1,
            )
            set_height(row, max(255, lines * 255 + 15))
            row += 1

    # --- ПОДВАЛ (сдвигается вниз по мере добавления строк) ---
    base = row
    repl = {
        '%ДОЛЖНОСТЬ%': footer.get('dolzhnost') or '',
        '%ЗВАНИЕ%': footer.get('zvanie') or '',
        '%ФИО%': footer.get('fio') or '',
    }
    for tr in range(FOOTER_START, sh.nrows):
        fr = base + (tr - FOOTER_START)
        for c in range(MAXC):
            if (tr, c) in covered:
                continue
            val = sh.cell_value(tr, c)
            if isinstance(val, str):
                for k, v in repl.items():
                    if k in val:
                        val = val.replace(k, v)
            st = style_of(tr, c)
            if (tr, c) in anchors:
                r2, c2 = anchors[(tr, c)]
                ws.write_merge(fr, fr + (r2 - tr), c, c2, val, st)
            else:
                ws.write(fr, c, val, st)
        set_height(fr, height_of(tr))

    wb.save(out)
    print('OK')


if __name__ == '__main__':
    main()


