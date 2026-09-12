import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Check, Clock } from 'lucide-react';
import { useMessageReaders } from '../../hooks/useChat';
import AvatarView from './AvatarView';

const MessageReadersDialog = ({ open, onOpenChange, messageId }) => {
    const { data: readers, isLoading } = useMessageReaders(messageId, open);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl max-h-[70vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Прочитали сообщение</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto -mx-6 px-6">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                        </div>
                    ) : !readers?.length ? (
                        <div className="text-center text-slate-400 text-sm py-8">
                            Нет участников
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {readers.map((r) => (
                                <div
                                    key={r.user_id}
                                    className="flex items-center gap-3 py-2.5"
                                >
                                    <AvatarView
                                        avatar={r.avatar_url}
                                        name={r.display_name || r.username}
                                        size={36}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-slate-800 truncate">
                                            {r.display_name || r.username}
                                        </div>
                                        {r.display_name && (
                                            <div className="text-xs text-slate-400 truncate">
                                                @{r.username}
                                            </div>
                                        )}
                                    </div>
                                    <div
                                        className={`flex items-center gap-1 text-xs ${
                                            r.has_read ? 'text-green-600' : 'text-slate-400'
                                        }`}
                                    >
                                        {r.has_read ? (
                                            <>
                                                <Check className="h-3.5 w-3.5" />
                                                Прочитано
                                            </>
                                        ) : (
                                            <>
                                                <Clock className="h-3.5 w-3.5" />
                                                Не прочитано
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default MessageReadersDialog;