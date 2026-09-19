import { Loader2, WifiOff } from 'lucide-react';

// Полноэкранная блокирующая заглушка при потере соединения с сервером
const ConnectionOverlay = () => (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 max-w-sm w-[90%] text-center px-8 py-8 bg-white rounded-2xl shadow-2xl">
            <WifiOff className="h-10 w-10 text-orange-500" />
            <div className="text-lg font-semibold text-slate-800">
                Потеряно соединение с сервером
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Попытка восстановить доступ...
            </div>
        </div>
    </div>
);

export default ConnectionOverlay;