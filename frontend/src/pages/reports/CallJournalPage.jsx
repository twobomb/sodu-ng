import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useExportCallJournal } from '../../hooks/useCallJournal';
import { toast } from 'sonner';
import { FileText, Download, Loader2 } from 'lucide-react';

// Вчерашний день в локальном часовом поясе (YYYY-MM-DD)
const yesterdayIso = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA');
};

// Полная страница
const CallJournalPage = () => {
    const exportMut = useExportCallJournal();

    // Режим: 'single' — конкретная дата, 'range' — диапазон
    const [mode, setMode] = useState('single');
    const [date, setDate] = useState(yesterdayIso);
    const [dateFrom, setDateFrom] = useState(yesterdayIso);
    const [dateTo, setDateTo] = useState(yesterdayIso);

    const [officers, setOfficers] = useState({
        sdal_zvanie: '',
        sdal_fio: '',
        prinyal_zvanie: '',
        prinyal_fio: '',
        proveril_zvanie: '',
        proveril_fio: '',
    });
    const setOfficer = (k, v) => setOfficers((p) => ({ ...p, [k]: v }));

    // Группы полей «Дежурство / Проверил» для формы
    const GROUPS = [
        {
            title: 'Дежурство по гарнизону сдал',
            zvan: 'sdal_zvanie',
            fio: 'sdal_fio',
            zvanLabel: 'Звание',
            fioLabel: 'ФИО',
        },
        {
            title: 'Дежурство по гарнизону принял',
            zvan: 'prinyal_zvanie',
            fio: 'prinyal_fio',
            zvanLabel: 'Звание',
            fioLabel: 'ФИО',
        },
        {
            title: 'Проверил',
            zvan: 'proveril_zvanie',
            fio: 'proveril_fio',
            zvanLabel: 'Звание',
            fioLabel: 'ФИО',
        },
    ];

    const handleExport = async () => {
        const from = mode === 'single' ? date : dateFrom;
        const to = mode === 'single' ? date : dateTo;
        if (!from || !to) {
            toast.error('Укажите дату');
            return;
        }
        try {
            const res = await exportMut.mutateAsync({
                date_from: from,
                date_to: to,
                sdal_zvanie: officers.sdal_zvanie.trim(),
                sdal_fio: officers.sdal_fio.trim(),
                prinyal_zvanie: officers.prinyal_zvanie.trim(),
                prinyal_fio: officers.prinyal_fio.trim(),
                proveril_zvanie: officers.proveril_zvanie.trim(),
                proveril_fio: officers.proveril_fio.trim(),
            });
            const { base64, filename } = res.data;

            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || 'Журнал вызовов.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('Файл сформирован');
        } catch (e) {
            toast.error(e?.response?.data?.error || 'Не удалось сформировать выгрузку');
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="h-6 w-6 text-orange-500" />
                    Выгрузка журнала вызовов
                </h1>
                <p className="text-sm text-slate-400">
                    Формирование xlsx-файла по шаблону. Вызовы выбираются по полю
                    «Время получения сообщения».
                </p>
            </div>

            {/* Выбор периода */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-[3px_5px_11px_1px_#0000002e] p-4">
                <Label className="text-sm font-medium text-slate-700">Период</Label>
                <div className="flex items-center gap-2 mt-1">
                    <Button
                        variant={mode === 'single' ? 'default' : 'outline'}
                        type="button"
                        onClick={() => setMode('single')}
                        className="rounded-lg"
                    >
                        Конкретная дата
                    </Button>
                    <Button
                        variant={mode === 'range' ? 'default' : 'outline'}
                        type="button"
                        onClick={() => setMode('range')}
                        className="rounded-lg"
                    >
                        По диапазону дат
                    </Button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                    По умолчанию выбран вчерашний день
                </p>

                {mode === 'single' ? (
                    <div className="space-y-2 mt-3">
                        <Label htmlFor="journal-date">Дата</Label>
                        <Input
                            id="journal-date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="rounded-lg"
                        />
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 mt-3">
                        <div className="space-y-2">
                            <Label htmlFor="journal-from">Начиная с</Label>
                            <Input
                                id="journal-from"
                                type="date"
                                value={dateFrom}
                                max={dateTo || undefined}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="rounded-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="journal-to">По дату</Label>
                            <Input
                                id="journal-to"
                                type="date"
                                value={dateTo}
                                min={dateFrom || undefined}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="rounded-lg"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Дежурство и проверка */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-[3px_5px_11px_1px_#0000002e] p-4">
                <h2 className="text-base font-semibold text-slate-700">Ответственные</h2>
                <div className="grid gap-4 lg:grid-cols-3 mt-3">
                    {GROUPS.map((g) => (
                        <div
                            key={g.title}
                            className="rounded-lg border border-slate-200 bg-white p-3"
                        >
                            <Label className="text-sm font-medium text-slate-700">
                                {g.title}
                            </Label>
                            <div className="space-y-2 mt-2">
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">{g.zvanLabel}</Label>
                                    <Input
                                        value={officers[g.zvan]}
                                        onChange={(e) => setOfficer(g.zvan, e.target.value)}
                                        placeholder="Звание (напр. майор внутренней службы)"
                                        className="rounded-lg"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">{g.fioLabel}</Label>
                                    <Input
                                        value={officers[g.fio]}
                                        onChange={(e) => setOfficer(g.fio, e.target.value)}
                                        placeholder="ФИО"
                                        className="rounded-lg"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-end">
                <Button
                    onClick={handleExport}
                    disabled={exportMut.isPending}
                    className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                >
                    {exportMut.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <Download className="h-4 w-4 mr-2" />
                    )}
                    {exportMut.isPending ? 'Формирование...' : 'Выгрузить'}
                </Button>
            </div>
        </div>
    );
};

export default CallJournalPage;