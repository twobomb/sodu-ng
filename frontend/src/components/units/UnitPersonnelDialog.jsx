import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Search, Check, Truck } from 'lucide-react';

// ============================================================
// Диалог привязки личного состава к технике (страница «Техника»).
// Показываем только людей того же подразделения, что и техника.
// Компонент монтируется заново на каждую единицу техники (key),
// поэтому выбранных можно инициализировать прямо в useState.
// ============================================================
const UnitPersonnelDialog = ({ unit, personnel, onClose, onSubmit, pending, error }) => {
    const [selectedIds, setSelectedIds] = useState(() =>
        (personnel || []).filter((p) => p.unit_id === unit.id).map((p) => p.id)
    );
    const [search, setSearch] = useState('');

    // Кандидаты — люди того же подразделения, что и техника
    const candidates = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (personnel || [])
            .filter((p) => p.department_id === unit.department_id)
            .filter(
                (p) =>
                    !q ||
                    (p.full_name || '').toLowerCase().includes(q) ||
                    (p.position || '').toLowerCase().includes(q) ||
                    (p.rank_name || '').toLowerCase().includes(q)
            )
            .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'ru'));
    }, [personnel, unit.department_id, search]);

    const toggle = (id) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    return (
        <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Личный состав техники</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Truck className="h-4 w-4 text-slate-400" />
                        <span className="font-medium">{unit.name}</span>
                        {unit.department_name && (
                            <span className="text-slate-400">· {unit.department_name}</span>
                        )}
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Поиск по ФИО, должности, званию..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 rounded-lg"
                        />
                    </div>

                    <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                        {candidates.length === 0 && (
                            <p className="p-4 text-sm text-slate-400 text-center">
                                Нет людей этого подразделения.
                            </p>
                        )}
                        {candidates.map((p) => {
                            const checked = selectedIds.includes(p.id);
                            const onOtherUnit = p.unit_id && p.unit_id !== unit.id;
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => toggle(p.id)}
                                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
                                >
                                    <span
                                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                                            checked
                                                ? 'border-orange-500 bg-orange-500 text-white'
                                                : 'border-slate-300 bg-white'
                                        }`}
                                    >
                                        {checked && <Check className="h-3 w-3" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm text-slate-800">
                                            {p.full_name}
                                        </span>
                                        <span className="block truncate text-xs text-slate-500">
                                            {[p.rank_name, p.position].filter(Boolean).join(' · ') || '—'}
                                            {onOtherUnit && (
                                                <span className="text-amber-600">
                                                    {' '}· сейчас на «{p.unit_name || 'технике'}»
                                                </span>
                                            )}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <p className="text-xs text-slate-400">
                        Отмечены привязанные к технике. Доступны только люди того же подразделения.
                    </p>

                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        className="rounded-lg"
                        disabled={pending}
                    >
                        Отмена
                    </Button>
                    <Button
                        type="button"
                        onClick={() => onSubmit(selectedIds)}
                        disabled={pending}
                        className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                    >
                        {pending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Сохранение...
                            </>
                        ) : (
                            'Сохранить'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default UnitPersonnelDialog;
