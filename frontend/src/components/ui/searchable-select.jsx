import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const SearchableSelect = ({
                                     options = [],
                                     groups,
                                     value,
                                     onChange,
                                     placeholder = 'Выберите...',
                                     renderOption,
                                     renderValue,
                                     disabled = false,
                                     className,
                                     emptyText = 'Ничего не найдено',
                                 }) => {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const triggerRef = React.useRef(null);
    const contentRef = React.useRef(null);
    const inputRef = React.useRef(null);
    const [coords, setCoords] = React.useState({ top: 0, left: 0, width: 0 });

    // Плоский список опций (без заголовков групп) — для поиска и выбранного значения
    const flatOptions = React.useMemo(
        () => (groups ? groups.flatMap((g) => g.options) : options),
        [groups, options]
    );

    const selected = flatOptions.find((o) => o.value === value) || null;

    const matchesQuery = React.useCallback(
        (o) => {
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            const label = (o.label || '').toString().toLowerCase();
            const extra = (o.extra || '').toString().toLowerCase();
            const s = (o.search || '').toString().toLowerCase();
            return label.includes(q) || extra.includes(q) || s.includes(q);
        },
        [search]
    );

    // Плоский отфильтрованный список (используется, когда группы не заданы)
    const filtered = React.useMemo(
        () => flatOptions.filter(matchesQuery),
        [flatOptions, matchesQuery]
    );

    // Отфильтрованные группы: скрываем пустые (в т.ч. при поиске)
    const filteredGroups = React.useMemo(() => {
        if (!groups) return null;
        return groups
            .map((g) => ({ ...g, options: g.options.filter(matchesQuery) }))
            .filter((g) => g.options.length > 0);
    }, [groups, matchesQuery]);

    // Клик вне и Escape
    React.useEffect(() => {
        if (!open) return;

        const handleClickOutside = (e) => {
            if (triggerRef.current?.contains(e.target)) return;
            if (contentRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const handleEsc = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };

        document.addEventListener('mouseup', handleClickOutside);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mouseup', handleClickOutside);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [open]);

    // Позиционирование
    React.useEffect(() => {
        if (!open || !triggerRef.current) return;

        const updatePosition = () => {
            const rect = triggerRef.current.getBoundingClientRect();
            const contentHeight = contentRef.current?.offsetHeight || 320;
            let top = rect.bottom + 4;
            if (top + contentHeight > window.innerHeight - 8) {
                top = Math.max(8, rect.top - contentHeight - 4);
            }
            setCoords({ top, left: rect.left, width: rect.width });
        };

        updatePosition();
        const raf = requestAnimationFrame(updatePosition);
        window.addEventListener('resize', updatePosition);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', updatePosition);
        };
    }, [open]);

    // Простой фокус на input при открытии
    React.useEffect(() => {
        if (open) {
            setSearch('');
            const raf = requestAnimationFrame(() => inputRef.current?.focus());
            return () => cancelAnimationFrame(raf);
        }
    }, [open]);

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setOpen(false);
    };

    // Общий рендер одной опции (используется и в плоском списке, и в группах)
    const optionButton = (option, isSelected) => (
        <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                isSelected
                    ? 'bg-orange-200 text-orange-900'
                    : 'text-slate-700 hover:bg-slate-300'
            )}
        >
                  <span className="flex-1 min-w-0">
                    {renderOption ? (
                        renderOption(option)
                    ) : (
                        <span className="truncate">{option.label}</span>
                    )}
                  </span>
            {isSelected && (
                <Check className="h-4 w-4 text-orange-600 flex-shrink-0" />
            )}
        </button>
    );

    const emptyBlock = (
        <div className="px-3 py-6 text-center text-xs text-slate-500">
            {emptyText}
        </div>
    );

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen((v) => !v)}
                className={cn(
                    'flex items-center justify-between gap-2 w-full px-3 py-2 h-10',
                    'rounded-lg border border-slate-200 bg-white text-sm text-left',
                    'hover:border-slate-300 transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent',
                    disabled && 'opacity-50 cursor-not-allowed',
                    className
                )}
            >
        <span className="flex-1 min-w-0 truncate">
          {selected ? (
              renderValue ? (
                  renderValue(selected)
              ) : (
                  <span className="text-slate-800">{selected.label}</span>
              )
          ) : (
              <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
                <ChevronDown
                    className={cn(
                        'h-4 w-4 text-slate-400 flex-shrink-0 transition-transform',
                        open && 'rotate-180'
                    )}
                />
            </button>

            {open &&
                createPortal(
                    <div
                        ref={contentRef}
                        data-searchable-select-portal="true"
                        style={{
                            position: 'fixed',
                            top: coords.top,
                            left: coords.left,
                            width: Math.max(coords.width, 220),
                            pointerEvents: 'auto',
                        }}
                        className="z-[9999] bg-slate-100 rounded-lg shadow-xl border border-slate-300 overflow-hidden"
                    >
                        {/* Поиск */}
                        <div className="p-2 border-b border-slate-300 bg-slate-100">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Поиск..."
                                    className="w-full pl-8 pr-7 py-1.5 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearch('');
                                            inputRef.current?.focus();
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full hover:bg-slate-300 flex items-center justify-center"
                                    >
                                        <X className="h-2.5 w-2.5 text-slate-600" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Список опций */}
                        <div className="max-h-[280px] overflow-y-auto py-1 bg-slate-100">
                            {filteredGroups
                                ? filteredGroups.length === 0 ? (
                                    emptyBlock
                                ) : (
                                    filteredGroups.map((group) => (
                                        <div key={group.key || group.label}>
                                            <div className="flex items-center gap-2 px-3 py-2 text-[12px] font-bold uppercase tracking-wide text-slate-700 bg-gradient-to-r from-slate-200 to-slate-100/60 sticky top-0 z-10">
                                                {group.label}
                                            </div>
                                            <div className="h-px bg-slate-300" aria-hidden="true" />
                                            {group.options.map((option) =>
                                                optionButton(option, option.value === value)
                                            )}
                                        </div>
                                    ))
                                )
                                : filtered.length === 0 ? (
                                    emptyBlock
                                ) : (
                                    filtered.map((option) =>
                                        optionButton(option, option.value === value)
                                    )
                                )}
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
};

export default SearchableSelect;