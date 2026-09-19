import * as React from 'react';
import {Loader2, Search} from 'lucide-react';
import {getAddressAutocomplete} from '@/api/address';

const DEBOUNCE_MS = 250;

/**
 * Поле ввода адреса с автодополнением из справочника ФИАС (SQLite на бэкенде).
 * Ведёт себя как обычный контролируемый input: value + onChange(string).
 * При выборе пункта подставляет полную отформатированную строку адреса.
 */
export const AddressAutocomplete = ({
                                        id,
                                        value = '',
                                        onChange,
                                        disabled = false,
                                        placeholder = 'Адрес',
                                        limit = 8,
                                    }) => {
    const [open, setOpen] = React.useState(false);
    const [options, setOptions] = React.useState([]);
    const [selectedIdx, setSelectedIdx] = React.useState(-1);
    const [loading, setLoading] = React.useState(false);

    const rootRef = React.useRef(null);
    const listRef = React.useRef(null);
    const inputRef = React.useRef(null);
    const timerRef = React.useRef(null);
    const requestSeq = React.useRef(0);

    // Закрытие по клику вне и по Escape
    React.useEffect(() => {
        if (!open) return;
        const handleMouseDown = (e) => {
            if (rootRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const handleKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);

    // Автопрокрутка активного пункта в списке
    React.useEffect(() => {
        if (selectedIdx < 0 || !listRef.current) return;
        const el = listRef.current.children[selectedIdx];
        el?.scrollIntoView?.({block: 'nearest'});
    }, [selectedIdx]);

    const fetchOptions = React.useCallback(
        (q) => {
            const seq = ++requestSeq.current;
            if (!q.trim()) {
                setOptions([]);
                setSelectedIdx(-1);
                setLoading(false);
                return;
            }
            setLoading(true);
            getAddressAutocomplete(q, limit)
                .then((r) => {
                    if (seq !== requestSeq.current) return;
                    setSelectedIdx(-1);
                    const rows = Array.isArray(r.data?.results) ? r.data.results : [];
                    setOptions(rows);
                })
                .catch(() => {
                    if (seq !== requestSeq.current) return;
                    setOptions([]);
                })
                .finally(() => {
                    if (seq === requestSeq.current) setLoading(false);
                });
        },
        [limit]
    );

    const handleChange = (q) => {
        const newValue = q || '';
        setOpen(true);
        setSelectedIdx(-1);
        if (onChange) onChange(newValue);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => fetchOptions(newValue), DEBOUNCE_MS);
    };

    const handleFocus = () => {
        if (disabled) return;
        setOpen(true);
    };

    const handleSelect = (opt) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        requestSeq.current++;
        setOpen(false);
        setOptions([]);
        const next = opt.display || '';
        if (onChange) onChange(next);
        // Не убираем фокус: оставляем его на поле адреса, а курсор ставим в конец.
        const input = inputRef.current;
        if (input) {
            const len = next.length;
            requestAnimationFrame(() => {
                input.focus();
                input.setSelectionRange(len, len);
            });
        }
    };

    const handleKeyDown = (e) => {
        if (!open || !options.length) {
            if (e.key === 'Escape' && open) setOpen(false);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIdx((prev) => (prev + 1) % options.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIdx((prev) => (prev - 1 + options.length) % options.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const idx = selectedIdx >= 0 ? selectedIdx : 0;
            if (options[idx]) handleSelect(options[idx]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div ref={rootRef} className="relative">
            <input
                ref={inputRef}
                id={id}
                type="text"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={value}
                disabled={disabled}
                placeholder={placeholder}
                onChange={(e) => handleChange(e.target.value)}
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none dark:bg-input/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground md:text-sm"
            />

            {loading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Loader2 className="h-4 w-4 animate-spin"/>
                </span>
            )}

            {open && (
                <div
                    className="absolute inset-x-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-sm">
                    {loading && !options.length ? (
                        <div className="px-3 py-3 text-center text-xs text-slate-500">Поиск…</div>
                    ) : options.length === 0 ? (
                        !value.trim() ? null : (
                            <div className="px-3 py-3 text-center text-xs text-slate-500">Ничего не найдено</div>
                        )
                    ) : (
                        <div ref={listRef} className="max-h-[274px] overflow-hidden">
                            {options.map((opt, idx) => (
                                <button
                                    key={`${idx}-${opt.display}`}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleSelect(opt)}
                                    className={
                                        (selectedIdx === idx
                                            ? 'bg-orange-100 text-orange-900 '
                                            : 'text-slate-700 hover:bg-slate-100 ') +
                                        'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors'
                                    }
                                >
                                    <Search className="h-3.5 w-3.5 text-slate-400 shrink-0"/>
                                    <span className="flex-1 min-w-0 truncate">{opt.display}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AddressAutocomplete;