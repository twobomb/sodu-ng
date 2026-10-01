import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useExportDailyStatement } from '../../hooks/useDailyStatement';
import { toast } from 'sonner';
import { FileSpreadsheet, Download, Loader2 } from 'lucide-react';

// Вчерашний день в локальном часовом поясе (YYYY-MM-DD)
const yesterdayIso = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString('en-CA');
};

const DailyStatementPage = () => {
    const exportMut = useExportDailyStatement();

    const [date, setDate] = useState(yesterdayIso);
    const [officer, setOfficer] = useState({ dolzhnost: '', zvanie: '', fio: '' });
    const setField = (k, v) => setOfficer((p) => ({ ...p, [k]: v }));

    const handleExport = async () => {
        if (!date) {
            toast.error('Укажите дату');
            return;
        }
        try {
            const res = await exportMut.mutateAsync({
                date,
                dolzhnost: officer.dolzhnost.trim(),
                zvanie: officer.zvanie.trim(),
                fio: officer.fio.trim(),
            });
            const { base64, filename } = res.data;

            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const blob = new Blob([bytes], { type: 'application/vnd.ms-excel' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || 'Суточная ведомость.xls';
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
                    <FileSpreadsheet className="h-6 w-6 text-orange-500" />
                    Выгрузка суточной ведомости
                </h1>
                <p className="text-sm text-slate-400">
                    Формирование xls-файла по шаблону. Вызовы выбираются по полю «Время получения
                    сообщения» и группируются по типам; ошибочные вызовы не попадают.
                </p>
            </div>

            {/* Дата */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-[3px_5px_11px_1px_#0000002e] p-4">
                <h2 className="text-base font-semibold text-slate-700">Дата</h2>
                <div className="space-y-2 mt-3 max-w-xs">
                    <Label htmlFor="statement-date">Дата ведомости</Label>
                    <Input
                        id="statement-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="rounded-lg"
                    />
                    <p className="text-xs text-slate-400">По умолчанию выбран вчерашний день</p>
                </div>
            </div>

            {/* Ответственный */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-[3px_5px_11px_1px_#0000002e] p-4">
                <h2 className="text-base font-semibold text-slate-700">Ответственный (подвал листа)</h2>
                <div className="grid gap-4 sm:grid-cols-3 mt-3">
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Должность</Label>
                        <Input
                            value={officer.dolzhnost}
                            onChange={(e) => setField('dolzhnost', e.target.value)}
                            placeholder="Начальник караула"
                            className="rounded-lg"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Звание</Label>
                        <Input
                            value={officer.zvanie}
                            onChange={(e) => setField('zvanie', e.target.value)}
                            placeholder="капитан внутренней службы"
                            className="rounded-lg"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">ФИО</Label>
                        <Input
                            value={officer.fio}
                            onChange={(e) => setField('fio', e.target.value)}
                            placeholder="Иванов И.И."
                            className="rounded-lg"
                        />
                    </div>
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

export default DailyStatementPage;
