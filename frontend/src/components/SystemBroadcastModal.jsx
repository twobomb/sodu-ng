import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLiveBroadcast } from '../hooks/useSettings';

const SystemBroadcastModal = () => {
    const { data: broadcast } = useLiveBroadcast();
    // id подтверждённых сообщений в этой сессии
    const [ackedId, setAckedId] = useState(null);

    const isVisible =
        broadcast?.id && broadcast.id !== ackedId;

    const handleAcknowledge = () => {
        if (broadcast?.id) {
            setAckedId(broadcast.id);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-red-600 px-6 py-4 flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                        <Megaphone className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold text-white truncate">
                            {broadcast.title}
                        </h2>
                        <p className="text-xs text-white/80">Системное сообщение</p>
                    </div>
                </div>

                <div className="p-6">
                    <div className="text-slate-700 text-[15px] leading-relaxed whitespace-pre-wrap break-words max-h-[55vh] overflow-y-auto">
                        {broadcast.message}
                    </div>
                </div>

                <div className="px-6 pb-6 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-400">
                        {broadcast.sent_by && <>Сообщение от разработчика</>}
                    </div>
                    <Button
                        onClick={handleAcknowledge}
                        className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg px-6"
                    >
                        Понятно
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default SystemBroadcastModal;