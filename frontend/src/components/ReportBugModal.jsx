import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bug, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { useMutation } from '@tanstack/react-query';
import { reportBug } from '../api/reports';
import { useChatState } from '../context/ChatContext';

const ReportBugModal = ({ open, onOpenChange }) => {
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { setActiveConversationId, setIsOpen } = useChatState();

    const mutation = useMutation({
        mutationFn: reportBug,
        onSuccess: (res) => {
            const data = res.data;
            // Закрываем модалку и очищаем поле
            setMessage('');
            onOpenChange(false);
            // Открываем чат с developer
            if (data?.conversation_id) {
                setIsOpen(true);
                setActiveConversationId(data.conversation_id);
            }
        },
        onError: (err) => {
            setError(
                err.response?.data?.error ||
                'Не удалось отправить. Попробуйте ещё раз.'
            );
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!message.trim() || message.trim().length < 5) {
            setError('Опишите проблему подробнее (минимум 5 символов)');
            return;
        }

        mutation.mutate({
            message: message.trim(),
            context: window.location.pathname,
        });
    };

    const handleClose = (o) => {
        if (!mutation.isPending) {
            if (!o) {
                setMessage('');
                setError('');
            }
            onOpenChange(o);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Bug className="h-5 w-5 text-orange-500" />
                        Сообщить об ошибке
                    </DialogTitle>
                    <DialogDescription>
                        Опишите проблему — сообщение уйдёт разработчику в личный чат.
                        Ответ придёт туда же.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="bug-message">Описание проблемы</Label>
                            <textarea
                                id="bug-message"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Что произошло? Что вы делали перед этим?"
                                rows={6}
                                maxLength={5000}
                                autoFocus
                                className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent min-h-[120px]"
                            />
                            <p className="text-xs text-slate-400 text-right">
                                {message.length} / 5000
                            </p>
                        </div>

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
                            onClick={() => handleClose(false)}
                            disabled={mutation.isPending}
                            className="rounded-lg"
                        >
                            Отмена
                        </Button>
                        <Button
                            type="submit"
                            disabled={mutation.isPending || !message.trim()}
                            className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 gap-1.5"
                        >
                            {mutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Отправка...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Отправить
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ReportBugModal;