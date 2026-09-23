import { useState } from 'react';
import {
    isSoundEnabled,
    setSoundEnabled,
    playNotificationSound,
} from '../../lib/notificationSound';
import {
    isUnitSoundEnabled,
    setUnitSoundEnabled,
    playUnitStatusSound,
} from '../../lib/unitNotificationSound';
import {
    isCallSoundEnabled,
    setCallSoundEnabled,
    playNewCallSound,
} from '../../lib/callNotificationSound';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import {
    Volume2,
    MessageCircle,
    Truck,
    Siren,
} from 'lucide-react';

// Переключатель «вкл/выкл» в том же стиле, что в настройках чата
const SoundSwitch = ({ on, onToggle, title }) => (
    <button
        type="button"
        onClick={onToggle}
        role="switch"
        aria-checked={on}
        title={title}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
            on ? 'bg-orange-500' : 'bg-slate-300'
        }`}
    >
        <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                on ? 'translate-x-6' : 'translate-x-1'
            }`}
        />
    </button>
);

// Общая строка настройки звука с иконкой, описанием и переключателем
const SoundRow = ({ icon, title, description, on, onToggle }) => (
    <div className="rounded-lg border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
                {icon}
                <div>
                    <div className="text-sm font-medium text-slate-800">{title}</div>
                    <div className="text-xs text-slate-500">{description}</div>
                </div>
            </div>
            <SoundSwitch
                on={on}
                onToggle={onToggle}
                title={on ? `Выключить: ${title}` : `Включить: ${title}`}
            />
        </div>
    </div>
);

const SoundsTab = () => {
    // Чат
    const [chatOn, setChatOn] = useState(isSoundEnabled());
    // Техника (мониторинг техники)
    const [unitOn, setUnitOn] = useState(isUnitSoundEnabled());
    // Вызовы (мониторинг вызовов)
    const [callOn, setCallOn] = useState(isCallSoundEnabled());

    const toggleChat = () => {
        const next = !chatOn;
        setChatOn(next);
        setSoundEnabled(next);
        if (next) playNotificationSound();
    };

    const toggleUnit = () => {
        const next = !unitOn;
        setUnitOn(next);
        setUnitSoundEnabled(next);
        if (next) playUnitStatusSound();
    };

    const toggleCall = () => {
        const next = !callOn;
        setCallOn(next);
        setCallSoundEnabled(next);
        if (next) playNewCallSound();
    };

    return (
        <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Volume2 className="h-5 w-5 text-orange-500" />
                    Звуковые уведомления
                </CardTitle>
                <CardDescription>
                    Включение и выключение звуков на страницах системы.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <SoundRow
                    icon={
                        chatOn ? (
                            <MessageCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        ) : (
                            <MessageCircle className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        )
                    }
                    title="Чат"
                    description="Проигрывать звук при новом сообщении в чате"
                    on={chatOn}
                    onToggle={toggleChat}
                />
                <SoundRow
                    icon={
                        unitOn ? (
                            <Truck className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        ) : (
                            <Truck className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        )
                    }
                    title="Техника"
                    description="Проигрывать звук при смене статуса техники на мониторинге техники"
                    on={unitOn}
                    onToggle={toggleUnit}
                />
                <SoundRow
                    icon={
                        callOn ? (
                            <Siren className="h-4 w-4 text-orange-500 flex-shrink-0" />
                        ) : (
                            <Siren className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        )
                    }
                    title="Вызовы"
                    description="Проигрывать звук при появлении нового вызова на мониторинге вызовов"
                    on={callOn}
                    onToggle={toggleCall}
                />
            </CardContent>
        </Card>
    );
};

export default SoundsTab;