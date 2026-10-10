import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    CALLS_COLUMNS,
    defaultColumnsState,
    normalizeColumnsState,
} from '../../lib/callColumns';
import { Columns3, GripVertical, RotateCcw } from 'lucide-react';

/**
 * Диалог «Отображаемые поля»:
 *  - галочками включаются/выключаются колонки;
 *  - перетаскиванием за значок слева задаётся их порядок.
 */
const CallsColumnsDialog = ({ open, onOpenChange, columns, onChange }) => {
    const state = normalizeColumnsState(columns);
    const [dragKey, setDragKey] = useState(null);
    const [overKey, setOverKey] = useState(null);

    const visibleCount = state.order.filter((k) => !state.hidden.includes(k)).length;
    const labelOf = (key) => CALLS_COLUMNS.find((c) => c.key === key)?.label || key;

    const toggle = (key) => {
        const isHidden = state.hidden.includes(key);
        // Последнее видимое поле скрыть нельзя
        if (!isHidden && visibleCount <= 1) return;
        onChange({
            ...state,
            hidden: isHidden
                ? state.hidden.filter((k) => k !== key)
                : [...state.hidden, key],
        });
    };

    // Перестановка колонок: fromKey встаёт на место toKey
    const reorder = (fromKey, toKey) => {
        const order = state.order.filter((k) => k !== fromKey);
        const idx = order.indexOf(toKey);
        order.splice(idx < 0 ? order.length : idx, 0, fromKey);
        onChange({ ...state, order });
    };

    const handleDragStart = (key) => (e) => {
        setDragKey(key);
        e.dataTransfer.effectAllowed = 'move';
        // Firefox требует установить данные
        e.dataTransfer.setData('text/plain', key);
    };

    const handleDragEnd = () => {
        setDragKey(null);
        setOverKey(null);
    };

    const handleDragOver = (key) => (e) => {
        if (!dragKey) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (overKey !== key) setOverKey(key);
    };

    const handleDrop = (key) => (e) => {
        e.preventDefault();
        if (dragKey && dragKey !== key) reorder(dragKey, key);
        setDragKey(null);
        setOverKey(null);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-lg flex items-center gap-2">
                        <Columns3 className="h-5 w-5 text-orange-500" />
                        Отображаемые поля
                    </DialogTitle>
                </DialogHeader>

                <p className="text-xs text-slate-500">
                    Перетаскивайте поля за значок слева, чтобы изменить порядок колонок.
                    Видимых полей: {visibleCount}.
                </p>

                <div className="py-1 space-y-1 max-h-[60vh] overflow-y-auto">
                    {state.order.map((key) => {
                        const visibleNow = !state.hidden.includes(key);
                        const isDragging = dragKey === key;
                        const isOver = !!dragKey && overKey === key && dragKey !== key;
                        return (
                            <div
                                key={key}
                                onDragOver={handleDragOver(key)}
                                onDrop={handleDrop(key)}
                                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                                    isDragging ? 'opacity-50' : ''
                                } ${
                                    isOver
                                        ? 'border-orange-400 bg-orange-50'
                                        : 'border-transparent hover:bg-slate-50'
                                }`}
                            >
                                <span
                                    draggable
                                    onDragStart={handleDragStart(key)}
                                    onDragEnd={handleDragEnd}
                                    className="shrink-0 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
                                    title="Перетащите, чтобы изменить порядок"
                                >
                                    <GripVertical className="h-4 w-4" />
                                </span>
                                <input
                                    type="checkbox"
                                    checked={visibleNow}
                                    disabled={visibleNow && visibleCount <= 1}
                                    onChange={() => toggle(key)}
                                    className="h-4 w-4 rounded accent-orange-500"
                                    title={
                                        visibleNow && visibleCount <= 1
                                            ? 'Хотя бы одно поле должно остаться'
                                            : undefined
                                    }
                                />
                                <span className="text-sm text-slate-700 flex-1">{labelOf(key)}</span>
                            </div>
                        );
                    })}
                </div>

                <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onChange(defaultColumnsState())}
                        className="rounded-lg"
                        title="Вернуть поля и их порядок по умолчанию"
                    >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        По умолчанию
                    </Button>
                    <Button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                    >
                        Готово
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CallsColumnsDialog;
