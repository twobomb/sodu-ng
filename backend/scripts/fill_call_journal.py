# -*- coding: utf-8 -*-
"""Заполняет шаблон журнала вызовов (.xlsx) данными через openpyxl.

Полностью пересобирает тело журнала (шапка + даты + вызовы + подвал),
сохраняя стили шаблона (шрифты, рамки, заливки, высоты строк, объединения).

Структура шаблона template_call.xlsx:
  - строки 1..3  — шапка (не трогается, объединения сохраняются);
  - строка 4     — заголовок дня (ячейка A..M объединена), плейсхолдер %ДАТА%;
  - строки 5..7  — один вызов (пример): первая строка — «строка вызова»
                   (номер/дата/время/адрес-ход событий/тип во всех строках блока,
                   первая техника в E/F/G/L, оперативные времена в H/I/J/K),
                   последующие строки — привязки остальной техники (E/F/G/L);
                   %СРЕДСДТВА_ТУШЕНИЯ% — в объединённой ячейке H..K нижней части блока;
  - строки 8..13 — подвал с должностями (Дежурство по гарнизону сдал/принял, Проверил).

Особенности форматирования ячейки D (адрес/описание/ход событий):
  - адрес — жирным;
  - датавремя каждого события — жирным, текст события — обычным;
  - между адресом и описанием, а также между описанием и началом хода событий —
    пустая строка;
  - высота блока вызова подстраивается под содержимое D (по числу строк).

Usage:
  python fill_call_journal.py <template.xlsx> <data.json> <out.xlsx>

data.json:
{
  "footer": {
    "sdal_zvanie": "", "sdal_fio": "",
    "prinyal_zvanie": "", "prinyal_fio": "",
    "proveril_zvanie": "", "proveril_fio": ""
  },
  "days": [
    {
      "date": "ДД.ММ.ГГГГ",
      "calls": [
        {
          "number": 1,
          "call_date": "ДД.ММ.ГГГГ",
          "time": "чч:мм",
          "address": "",
          "description": "",
          "events": [ {"at": "ДД.ММ.ГГГГ чч:мм", "text": ""}, ... ],
          "type": "Пожар Ранг №1",
          "means": "...",
          "ops": {"barrel": "", "localization": "", "open_fire": "", "fire_elim": ""},
          "units": [ {"name": "", "dispatch": "", "arrival": "", "return": ""}, ... ]
        }
      ]
    }
  ]
}
"""
import sys
import json
import math
from copy import copy

from openpyxl import load_workbook

MAXC = 13           # колонки A..M
HEADER_END = 3      # шапка занимает строки 1..3
DATE_ROW_SRC = 4    # строка-заголовок дня в шаблоне
CALL_FIRST_SRC = 5  # первая строка блока вызова в шаблоне (строка «сам вызов»)
CALL_UNIT_SRC = 6   # вторая строка блока вызова в шаблоне (строка техники)
BOTTOM_FIRST_SRC = 8  # первая строка подвала в шаблоне (8..13)

# Колонки уровня вызова (вертикально объединяются на весь блок вызова):
CALL_MERGE_COLS = [1, 2, 3, 4, 13]  # A, B, C, D, M


def parse_rows(ref):
    """('B9:L9') -> (9, 9); ('A4:M4') -> (4, 4)."""
    a, _, b = ref.partition(':')
    ra = int(''.join(ch for ch in a if ch.isdigit()))
    rb = int(''.join(ch for ch in b if ch.isdigit())) if b else ra
    return ra, rb


def shift_ref(ref, offset):
    a, _, b = ref.partition(':')

    def sh(p):
        let = ''.join(ch for ch in p if not ch.isdigit())
        num = int(''.join(ch for ch in p if ch.isdigit()))
        return '%s%d' % (let, num + offset)

    return '%s:%s' % (sh(a), sh(b)) if b else sh(a)


def cap_cell(cell):
    return {
        'v': cell.value,
        'font': copy(cell.font),
        'border': copy(cell.border),
        'fill': copy(cell.fill),
        'alignment': copy(cell.alignment),
        'number_format': cell.number_format,
        'protection': copy(cell.protection),
    }


def apply_cell(cell, cap):
    for k in ('font', 'border', 'fill', 'alignment', 'protection'):
        setattr(cell, k, copy(cap[k]))
    cell.number_format = cap['number_format']


def cap_row(ws, r):
    return {
        'height': ws.row_dimensions[r].height if r in ws.row_dimensions else None,
        'cells': [cap_cell(ws.cell(r, c)) for c in range(1, MAXC + 1)],
    }


def apply_row(ws, r, cap, with_value):
    if cap['height'] is not None:
        ws.row_dimensions[r].height = cap['height']
    for c in range(1, MAXC + 1):
        cell = ws.cell(r, c)
        cc = cap['cells'][c - 1]
        apply_cell(cell, cc)
        if with_value:
            cell.value = cc['v']


def plain_d(call):
    """Плоский текст ячейки D (только для оценки высоты по содержимому).

    Пустая строка — между адресом, описанием и ходом событий; внутри хода
    событий каждая запись — с новой строки (без пустой строки).
    """
    addr = call.get('address') or ''
    desc = call.get('description') or ''
    events = call.get('events') or []

    blocks = []
    if addr:
        blocks.append([addr])
    if desc:
        blocks.append([desc])
    if events:
        ev_block = []
        for ev in events:
            at = ev.get('at') or ''
            txt = ev.get('text') or ''
            ev_block.append(('%s — %s' % (at, txt)) if at else txt)
        blocks.append(ev_block)

    joined = []
    for block in blocks:
        joined.append('\n'.join(block))
    return '\n\n'.join(joined)


def estimate_d_pt(call, d_width, font_sz):
    """Требуемая высота (в пунктах) для блока вызова под содержимое D."""
    text = plain_d(call)
    if not text:
        return 0
    cpl = max(8, int(d_width * 0.95))  # символов в строке колонки D
    n = 0
    for seg in text.split('\n'):
        n += max(1, math.ceil(len(seg) / cpl))
    return n * float(font_sz) * 1.32


def build_d_cell(call):
    """D (адрес/описание/ход событий) — обычная многострочная строка.

    Между адресом, описанием и ходом событий — пустая строка; записи хода — с
    новой строки. У колонки D в шаблоне включён перенос (wrap), поэтому `\\n`
    отображаются переносами. Обычная строка (без rich text) гарантированно
    открывается в Excel без запроса на «восстановление файла».
    """
    return plain_d(call)


def block_height(call):
    """Высота блока вызова: сам вызов + по строке на технику + строка под средства."""
    n = len(call.get('units') or [])
    return max(2, n + 1)


def main():
    tpl, datafile, out = sys.argv[1], sys.argv[2], sys.argv[3]
    with open(datafile, 'r', encoding='utf-8') as f:
        D = json.load(f)

    wb = load_workbook(tpl)
    ws = wb.active
    last = ws.max_row

    # Стили/значения берём ДО перестройки
    st_call = cap_row(ws, CALL_FIRST_SRC)
    st_unit = cap_row(ws, CALL_UNIT_SRC)
    st_date = cap_row(ws, DATE_ROW_SRC)
    bottom = [cap_row(ws, r) for r in range(BOTTOM_FIRST_SRC, last + 1)]

    d_width = float(ws.column_dimensions['D'].width or 55.0)
    font_sz = float(getattr(st_call['cells'][3]['font'], 'sz', None) or 10)

    merges = [str(r) for r in ws.merged_cells.ranges]
    header_merges = [r for r in merges if parse_rows(r)[1] <= HEADER_END]
    bottom_merges = [r for r in merges if parse_rows(r)[0] >= BOTTOM_FIRST_SRC]

    def cellval(x):
        """Пустую строку превращаем в None.

        openpyxl пишет '' как <c t="inlineStr"/> без <is> — Excel считает такой
        файл повреждённым. None даёт корректную пустую ячейку.
        """
        if x is None:
            return None
        if isinstance(x, str):
            return x if x != '' else None
        return x

    # Полностью очищаем тело журнала
    ws.merged_cells.ranges = []
    ws.delete_rows(HEADER_END + 1, last - HEADER_END)
    for r in list(ws.row_dimensions.keys()):
        if r and r >= HEADER_END + 1:
            del ws.row_dimensions[r]
    for ref in header_merges:
        ws.merge_cells(ref)

    row = HEADER_END + 1
    for day in D['days']:
        # Строка даты (A..M объединены)
        apply_row(ws, row, st_date, False)
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=MAXC)
        ws.cell(row, 1).value = day.get('date', '')
        row += 1

        # Блоки вызовов
        for call in day.get('calls', []):
            start = row
            h = block_height(call)
            apply_row(ws, row, st_call, False)
            for rr in range(row + 1, row + h):
                apply_row(ws, rr, st_unit, False)

            # Колонки уровня вызова объединяем на весь блок
            for col in CALL_MERGE_COLS:
                ws.merge_cells(start_row=start, start_column=col,
                               end_row=start + h - 1, end_column=col)

            ws.cell(start, 1).value = call.get('number')
            ws.cell(start, 2).value = cellval(call.get('call_date'))
            ws.cell(start, 3).value = cellval(call.get('time'))
            ws.cell(start, 4).value = cellval(build_d_cell(call))
            ws.cell(start, 13).value = cellval(call.get('type'))

            # Оперативные времена на первой строке (H, I, J, K)
            ops = call.get('ops') or {}
            ws.cell(start, 8).value = ops.get('barrel') or None
            ws.cell(start, 9).value = ops.get('localization') or None
            ws.cell(start, 10).value = ops.get('open_fire') or None
            ws.cell(start, 11).value = ops.get('fire_elim') or None

            # Техника: первая — на строке вызова, остальные — своими строками
            for i, u in enumerate(call.get('units') or []):
                ur = start + i
                ws.cell(ur, 5).value = cellval(u.get('name'))
                ws.cell(ur, 6).value = u.get('dispatch') or None
                ws.cell(ur, 7).value = u.get('arrival') or None
                ws.cell(ur, 12).value = u.get('return') or None

            # Средства пожаротушения — в объединённой ячейке H..K нижней части блока
            if call.get('means'):
                mt = start + 1
                mb = start + h - 1
                ws.merge_cells(start_row=mt, start_column=8,
                               end_row=mb, end_column=11)
                ws.cell(mt, 8).value = call['means']

            # Высота блока под содержимое D (ячейка обрезала текст)
            need = estimate_d_pt(call, d_width, font_sz)
            if need > 0:
                heights = []
                for rr in range(start, start + h):
                    ht = ws.row_dimensions[rr].height
                    heights.append(ht if ht is not None else 15.0)
                cur = sum(heights)
                if need > cur:
                    # Растягиваем по высоте последнюю строку блока (не первую):
                    # первая строка остаётся как в шаблоне, средства тушения не «уезжают».
                    ws.row_dimensions[start + h - 1].height = heights[h - 1] + (need - cur)

            row += h

    # Подвал
    off = row - BOTTOM_FIRST_SRC
    for bi, cap in enumerate(bottom):
        r = row + bi
        apply_row(ws, r, cap, True)
        for c in range(1, MAXC + 1):
            cell = ws.cell(r, c)
            val = cell.value
            if isinstance(val, str):
                f = D.get('footer', {})
                val = (
                    val.replace('%СДАЛ_ЗВАНИЕ%', f.get('sdal_zvanie', '') or '')
                       .replace('%СДАЛ_ФИО%', f.get('sdal_fio', '') or '')
                       .replace('%ПРИНЯЛ_ЗВАНИЕ%', f.get('prinyal_zvanie', '') or '')
                       .replace('%ПРИНЯЛ_ФИО%', f.get('prinyal_fio', '') or '')
                       .replace('%ПРОВЕРИЛ_ЗВАНИЕ%', f.get('proveril_zvanie', '') or '')
                       .replace('%ПРОВЕРИЛ_ФИО%', f.get('proveril_fio', '') or '')
                )
                cell.value = val if val != '' else None
    for ref in bottom_merges:
        ws.merge_cells(shift_ref(ref, off))

    wb.save(out)
    print('OK')


if __name__ == '__main__':
    main()