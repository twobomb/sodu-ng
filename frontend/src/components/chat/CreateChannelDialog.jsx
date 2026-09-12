import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Hash, Loader2, UserPlus } from 'lucide-react';
import { useCreateChannel } from '../../hooks/useChat';

const CreateChannelDialog = ({ open, onOpenChange }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isReadonly, setIsReadonly] = useState(false);
    const [allowInvites, setAllowInvites] = useState(true);

    const create = useCreateChannel();

    const reset = () => {
        setName('');
        setDescription('');
        setIsReadonly(false);
        setAllowInvites(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        create.mutate(
            {
                name: name.trim(),
                description: description.trim() || null,
                is_readonly: isReadonly,
                allow_member_invites: allowInvites,
            },
            {
                onSuccess: () => {
                    reset();
                    onOpenChange(false);
                },
            }
        );
    };

    const handleClose = (o) => {
        if (!o && !create.isPending) reset();
        onOpenChange(o);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Hash className="h-5 w-5 text-orange-500" />
                        Новый канал
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        {/* Название */}
                        <div className="space-y-2">
                            <Label htmlFor="ch-name">Название</Label>
                            <Input
                                id="ch-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Например, Дежурная смена"
                                required
                                autoFocus
                                className="rounded-lg"
                            />
                        </div>

                        {/* Описание */}
                        <div className="space-y-2">
                            <Label htmlFor="ch-desc">Описание</Label>
                            <Input
                                id="ch-desc"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Необязательно"
                                className="rounded-lg"
                            />
                        </div>

                        {/* Только чтение */}
                        <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                            <input
                                type="checkbox"
                                checked={isReadonly}
                                onChange={(e) => setIsReadonly(e.target.checked)}
                                className="h-4 w-4 mt-0.5 rounded accent-orange-500"
                            />
                            <div className="flex-1">
                                <div className="text-sm font-medium text-slate-800">
                                    Только чтение
                                </div>
                                <div className="text-xs text-slate-500">
                                    Писать смогут только администраторы канала
                                </div>
                            </div>
                        </label>

                        {/* Разрешить приглашать участникам */}
                        <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                            <input
                                type="checkbox"
                                checked={allowInvites}
                                onChange={(e) => setAllowInvites(e.target.checked)}
                                className="h-4 w-4 mt-0.5 rounded accent-orange-500"
                            />
                            <div className="flex-1">
                                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                                    <UserPlus className="h-3.5 w-3.5 text-slate-400" />
                                    Разрешить участникам приглашать
                                </div>
                                <div className="text-xs text-slate-500">
                                    Обычные участники смогут добавлять новых людей в канал
                                </div>
                            </div>
                        </label>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleClose(false)}
                            disabled={create.isPending}
                            className="rounded-lg"
                        >
                            Отмена
                        </Button>
                        <Button
                            type="submit"
                            disabled={create.isPending || !name.trim()}
                            className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                        >
                            {create.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Создание...
                                </>
                            ) : (
                                'Создать'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default CreateChannelDialog;