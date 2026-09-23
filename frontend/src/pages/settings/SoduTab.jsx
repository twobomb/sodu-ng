import { useState } from 'react';
import {
    useSoduSettings,
    useUpdateSoduSettings,
} from '../../hooks/useSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Loader2, Settings2, Map, Type, CheckCircle2 } from 'lucide-react';

const unwrap = (v) => (v && v.data !== undefined ? v.data : v);

const SoduTab = () => {
    const { data, isLoading, error } = useSoduSettings();
    const update = useUpdateSoduSettings();

    const [mapTemplate, setMapTemplate] = useState('');
    const [showMapButton, setShowMapButton] = useState(true);
    const [enableAutocomplete, setEnableAutocomplete] = useState(true);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('info');

    // Паттерн «adjusting state when a prop changes» — без setState в useEffect
    const [synced, setSynced] = useState(undefined);
    if (data !== synced) {
        setSynced(data);
        const s = unwrap(data);
        if (s !== undefined) {
            setMapTemplate(s.map_link_template || '');
            setShowMapButton(s.show_map_button !== false);
            setEnableAutocomplete(s.enable_address_autocomplete !== false);
        }
    }

    if (isLoading && !data) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                Ошибка загрузки настроек
            </div>
        );
    }

    const handleSave = () => {
        setMessage('');
        const template = (mapTemplate || '').trim();
        update.mutate(
            {
                map_link_template: template,
                show_map_button: showMapButton,
                enable_address_autocomplete: enableAutocomplete,
            },
            {
                onSuccess: () => {
                    setMessageType('success');
                    setMessage('Настройки сохранены');
                    setTimeout(() => setMessage(''), 3000);
                },
                onError: (err) => {
                    setMessageType('error');
                    setMessage(err.response?.data?.error || 'Ошибка сохранения');
                },
            }
        );
    };

    return (
        <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Settings2 className="h-5 w-5 text-orange-500" />
                    Настройки СОДУ
                </CardTitle>
                <CardDescription>
                    Глобальные настройки, применяются ко всем пользователям.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Ссылка поиска карты */}
                <div className="space-y-2">
                    <Label htmlFor="map-link">Ссылка открытия поиска карты</Label>
                    <Input
                        id="map-link"
                        value={mapTemplate}
                        onChange={(e) => setMapTemplate(e.target.value)}
                        placeholder="https://yandex.ru/maps/?&text=Луганская Народная Республика,$ADDRESS&z=14"
                        className="rounded-lg"
                    />
                    <p className="text-xs text-slate-400">
                        Плейсхолдер <code className="font-mono">$ADDRESS</code> будет
                        заменён на адрес вызова при нажатии кнопки карты.
                    </p>
                </div>

                {/* Показывать кнопку карты */}
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                        type="checkbox"
                        checked={showMapButton}
                        onChange={(e) => setShowMapButton(e.target.checked)}
                        className="h-5 w-5 mt-0.5 rounded accent-orange-500"
                    />
                    <div className="flex-1">
                        <div className="font-medium text-slate-800 flex items-center gap-2">
                            <Map className="h-4 w-4 text-orange-500" />
                            Показывать кнопку карты в вызове
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                            Кнопка открытия карты рядом с адресом в карточке вызова.
                        </p>
                    </div>
                </label>

                {/* Автодополнение адреса */}
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                    <input
                        type="checkbox"
                        checked={enableAutocomplete}
                        onChange={(e) => setEnableAutocomplete(e.target.checked)}
                        className="h-5 w-5 mt-0.5 rounded accent-orange-500"
                    />
                    <div className="flex-1">
                        <div className="font-medium text-slate-800 flex items-center gap-2">
                            <Type className="h-4 w-4 text-orange-500" />
                            Автодополнение адреса
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                            Подсказки адреса при вводе в поле адреса на странице вызова.
                        </p>
                    </div>
                </label>

                {message && (
                    <div
                        className={`text-sm p-3 rounded-lg border flex items-center gap-2 ${
                            messageType === 'error'
                                ? 'bg-red-50 text-red-600 border-red-200'
                                : 'bg-green-50 text-green-700 border-green-200'
                        }`}
                    >
                        {messageType !== 'error' && (
                            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                        )}
                        {message}
                    </div>
                )}

                <div className="flex justify-end">
                    <Button
                        onClick={handleSave}
                        disabled={update.isPending}
                        className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg"
                    >
                        {update.isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Сохранение...
                            </>
                        ) : (
                            'Сохранить'
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default SoduTab;