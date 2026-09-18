import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Loader2, History } from 'lucide-react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { useUnitMetricsHistory } from '../../hooks/useUnits';

const METRICS = [
    { value: 'gasoline', label: 'Бензин', unit: 'л' },
    { value: 'diesel', label: 'Дизель', unit: 'л' },
    { value: 'foam', label: 'Пена', unit: 'л' },
    { value: 'powder', label: 'Порошок', unit: 'кг' },
    { value: 'mileage', label: 'Пробег', unit: 'км' },
];

const fmtDT = (iso) => {
    try {
        return format(new Date(iso), 'dd.MM.yyyy HH:mm', { locale: ru });
    } catch {
        return iso || '';
    }
};

const CustomTooltip = ({ active, payload, unitLabel }) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0];
    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow">
            <div className="text-slate-400">{fmtDT(p.payload.changed_at)}</div>
            <div className="font-medium text-slate-700">
                {p.payload.value} {unitLabel}
            </div>
        </div>
    );
};

const UnitMetricsHistoryDialog = ({ open, onOpenChange, unit }) => {
    const [metric, setMetric] = useState('gasoline');
    const selected = useMemo(
        () => METRICS.find((m) => m.value === metric) || METRICS[0],
        [metric]
    );

    const historyQuery = useUnitMetricsHistory(unit?.id, metric, open && !!unit);

    const rows = Array.isArray(historyQuery.data) ? historyQuery.data : [];
    const isLoading = historyQuery.isLoading || historyQuery.isFetching;

    const chartData = rows.map((r) => ({
        changed_at: r.changed_at,
        value: r.value == null ? null : Number(r.value),
        _author: r.changed_by_username || '',
    }));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <History className="h-5 w-5 text-orange-500" />
                        История показателей: {unit?.name || ''}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Показатель</Label>
                        <NativeSelect
                            value={metric}
                            onChange={(e) => setMetric(e.target.value)}
                            className="w-full"
                        >
                            {METRICS.map((m) => (
                                <NativeSelectOption key={m.value} value={m.value}>
                                    {m.label} ({m.unit})
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    </div>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-56">
                            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 text-center text-slate-500 text-sm py-12">
                            По этому показателю изменений ещё не было
                        </div>
                    ) : (
                        <>
                            <div className="rounded-lg border border-slate-200 p-2">
                                <div className="h-56 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart
                                            data={chartData}
                                            margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                                        >
                                            <defs>
                                                <linearGradient id="metricFill" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                            <XAxis
                                                dataKey="changed_at"
                                                tickFormatter={fmtDT}
                                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                                stroke="#cbd5e1"
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11, fill: '#64748b' }}
                                                stroke="#cbd5e1"
                                                allowDecimals
                                            />
                                            <Tooltip content={<CustomTooltip unitLabel={selected.unit} />} />
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                name={selected.label}
                                                stroke="#f97316"
                                                strokeWidth={2}
                                                fill="url(#metricFill)"
                                                connectNulls
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="pt-1 text-center text-xs text-slate-400">
                                    Изменение показателя «{selected.label}» по датам
                                </div>
                            </div>
                            <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-400 uppercase">
                                        <tr>
                                            <th className="px-3 py-2 font-medium">Дата</th>
                                            <th className="px-3 py-2 font-medium text-right">Значение</th>
                                            <th className="px-3 py-2 font-medium">Кто изменил</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {rows.map((r) => (
                                            <tr key={r.id} className="hover:bg-slate-50">
                                                <td className="px-3 py-1.5 whitespace-nowrap">
                                                    {fmtDT(r.changed_at)}
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-medium text-slate-700 whitespace-nowrap">
                                                    {r.value == null ? '—' : `${r.value} ${selected.unit}`}
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-500">
                                                    {r.changed_by_username || '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="rounded-lg"
                    >
                        Закрыть
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default UnitMetricsHistoryDialog;