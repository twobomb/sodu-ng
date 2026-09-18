import { useState, useEffect } from 'react';
import { Gauge, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { useUpdateUnitMetrics } from '../../hooks/useUnits';

// Поля показателей техники: ключ → подпись и единица измерения
const METRIC_FIELDS = [
    { key: 'fuel_gasoline', label: 'Бензин', unit: 'л' },
    { key: 'fuel_diesel', label: 'Дизель', unit: 'л' },
    { key: 'foam_agent', label: 'Пена', unit: 'л' },
    { key: 'powder', label: 'Порошок', unit: 'кг' },
    { key: 'mileage', label: 'Пробег', unit: 'км' },
];

const UnitMetricsEditDialog = ({ open, onOpenChange, unit }) => {
    const updateMetrics = useUpdateUnitMetrics();
    const [form, setForm] = useState({});
    const [error, setError] = useState('');

    useEffect(() => {
        if (open && unit) {
            const init = {};
            for (const f of METRIC_FIELDS) {
                const v = unit[f.key];
                init[f.key] = v == null || v === '' ? '' : String(v);
            }
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setForm(init);
            setError('');
        }
    }, [open, unit]);

    const handleChange = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = () => {
        setError('');
        const payload = {};
        for (const f of METRIC_FIELDS) {
            const raw = (form[f.key] ?? '').toString().trim().replace(',', '.');
            if (raw === '') {
                payload[f.key] = null;
            } else {
                const num = Number(raw);
                if (Number.isNaN(num) || num < 0) {
                    setError(`Проверьте значение «${f.label}» (не может быть отрицательным)`);
                    return;
                }
                payload[f.key] = num;
            }
        }

        updateMetrics.mutate(
            { id: unit.id, data: payload },
            {
                onSuccess: () => {
                    onOpenChange(false);
                },
                onError: (err) =>
                    setError(err?.response?.data?.error || 'Ошибка сохранения показателей'),
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <Gauge className="h-5 w-5 text-orange-500" />
                        Показатели: {unit?.name || ''}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        {METRIC_FIELDS.map((f) => (
                            <div key={f.key} className="space-y-1.5">
                                <Label htmlFor={f.key}>
                                    {f.label}, {f.unit}
                                </Label>
                                <Input
                                    id={f.key}
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="0"
                                    value={form[f.key] ?? ''}
                                    onChange={(e) => handleChange(f.key, e.target.value)}
                                    className="rounded-lg"
                                />
                            </div>
                        ))}
                    </div>

                    {error && <p className="text-xs text-red-600">{error}</p>}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">
                        Отмена
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={updateMetrics.isPending}
                        className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                    >
                        {updateMetrics.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        Сохранить
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default UnitMetricsEditDialog;