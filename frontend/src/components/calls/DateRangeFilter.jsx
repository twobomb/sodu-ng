import { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'react-day-picker/locale';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarDays } from 'lucide-react';

// 'YYYY-MM-DD' → Date (локальная дата)
const toDate = (s) => {
    if (!s) return undefined;
    const parts = String(s).slice(0, 10).split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return undefined;
    return new Date(parts[0], parts[1] - 1, parts[2]);
};

// Date → 'YYYY-MM-DD'
const toStr = (d) => {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/**
 * Фильтр-диапазон по датам: одна кнопка, внутри календарь — «от» и «до».
 * Значение: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }.
 */
const DateRangeFilter = ({ label, value, onChange }) => {
    const [open, setOpen] = useState(false);
    const from = toDate(value?.from);
    const to = toDate(value?.to);
    const hasValue = !!(value?.from || value?.to);

    const text = hasValue
        ? `${value.from ? format(from, 'dd.MM.yyyy') : '…'} — ${value.to ? format(to, 'dd.MM.yyyy') : '…'}`
        : 'Любая дата';

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        className={`w-full justify-start rounded-lg font-normal ${
                            hasValue
                                ? 'border-orange-300 bg-orange-50 text-orange-700'
                                : ''
                        }`}
                    >
                        <CalendarDays className="h-4 w-4 mr-2 shrink-0" />
                        <span className="truncate">{text}</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="range"
                        numberOfMonths={1}
                        locale={ru}
                        selected={{ from, to }}
                        onSelect={(range) =>
                            onChange({ from: toStr(range?.from), to: toStr(range?.to) })
                        }
                        autoFocus
                    />
                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-2">
                        <span className="text-xs text-slate-500">Выберите «от» и «до»</span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!hasValue}
                            onClick={() => onChange({ from: '', to: '' })}
                            className="rounded-lg"
                        >
                            Очистить
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};

export default DateRangeFilter;
