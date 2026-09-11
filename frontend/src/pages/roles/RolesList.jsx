import { useState, useMemo } from 'react';
import {
    useRoles, usePermissionsCatalog, useCreateRole, useUpdateRole, useDeleteRole,
} from '../../hooks/useRoles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Loader2, Plus, Search, Edit, Trash2, Shield, Lock, CheckCircle2,
} from 'lucide-react';
import RoleForm from '../../components/RoleForm.jsx';

const RolesList = () => {
    const { data, isLoading, error } = useRoles();
    const { data: catalogData } = usePermissionsCatalog();
    const createRole = useCreateRole();
    const updateRole = useUpdateRole();
    const deleteRole = useDeleteRole();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRole, setSelectedRole] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState(null);
    const [formError, setFormError] = useState('');

    const roles = data?.data || [];
    const catalog = catalogData?.data || [];

    const totalPermissions = catalog.reduce((n, s) => n + s.permissions.length, 0);

    const filteredRoles = useMemo(() => {
        if (!searchTerm.trim()) return roles;
        const q = searchTerm.toLowerCase();
        return roles.filter(
            (r) =>
                r.code.toLowerCase().includes(q) ||
                r.name.toLowerCase().includes(q) ||
                r.description?.toLowerCase().includes(q)
        );
    }, [roles, searchTerm]);

    const handleCreate = () => {
        setSelectedRole(null);
        setFormError('');
        setIsFormOpen(true);
    };

    const handleEdit = (role) => {
        setSelectedRole(role);
        setFormError('');
        setIsFormOpen(true);
    };

    const confirmDelete = () => {
        if (!roleToDelete) return;
        deleteRole.mutate(roleToDelete.code, {
            onSuccess: () => setRoleToDelete(null),
            onError: (err) => {
                alert(err.response?.data?.error || 'Ошибка удаления');
                setRoleToDelete(null);
            },
        });
    };

    const handleFormSubmit = (formData) => {
        setFormError('');
        if (selectedRole) {
            updateRole.mutate(
                { code: selectedRole.code, data: formData },
                {
                    onSuccess: () => { setIsFormOpen(false); setSelectedRole(null); },
                    onError: (err) => setFormError(err.response?.data?.error || 'Ошибка обновления'),
                }
            );
        } else {
            createRole.mutate(formData, {
                onSuccess: () => setIsFormOpen(false),
                onError: (err) => setFormError(err.response?.data?.error || 'Ошибка создания'),
            });
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }
    if (error) {
        return (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                Ошибка загрузки ролей
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Роли и права</h2>
                    <p className="text-sm text-slate-500">
                        Всего: {filteredRoles.length} · Доступно правил: {totalPermissions}
                    </p>
                </div>
                <Button
                    onClick={handleCreate}
                    className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg shadow-md"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить роль
                </Button>
            </div>

            <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Поиск по коду, названию или описанию..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 rounded-lg"
                    />
                </div>
            </div>

            {filteredRoles.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-500">
                    <Shield className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                    <p>Нет ролей</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Код</TableHead>
                                <TableHead>Название</TableHead>
                                <TableHead>Правил</TableHead>
                                <TableHead>Тип</TableHead>
                                <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRoles.map((role) => {
                                const isDeveloper = role.code === 'developer';
                                return (
                                    <TableRow key={role.code}>
                                        <TableCell className="font-mono text-sm">{role.code}</TableCell>
                                        <TableCell>
                                            <div className="font-medium text-slate-800">{role.name}</div>
                                            {role.description && (
                                                <div className="text-xs text-slate-400">{role.description}</div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {isDeveloper ? (
                                                <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                                                    Полный доступ
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline">
                                                    {role.permissions?.length || 0} / {totalPermissions}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {role.is_system ? (
                                                <Badge className="bg-slate-100 text-slate-600">
                                                    <Lock className="h-3 w-3 mr-1" />
                                                    Системная
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-green-100 text-green-700">
                                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                                    Пользовательская
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEdit(role)}
                                                disabled={isDeveloper}
                                                title={isDeveloper ? 'Роль "Разработчик" нельзя изменить' : 'Редактировать'}
                                                className="h-8 w-8 p-0"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setRoleToDelete(role)}
                                                disabled={role.is_system}
                                                title={role.is_system ? 'Системную роль нельзя удалить' : 'Удалить'}
                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 disabled:opacity-30"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            <RoleForm
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open);
                    if (!open) { setFormError(''); setSelectedRole(null); }
                }}
                onSubmit={handleFormSubmit}
                initialData={selectedRole}
                isLoading={createRole.isPending || updateRole.isPending}
                error={formError}
                catalog={catalog}
            />

            <AlertDialog open={!!roleToDelete} onOpenChange={(o) => !o && setRoleToDelete(null)}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удаление роли</AlertDialogTitle>
                        <AlertDialogDescription>
                            Удалить роль «{roleToDelete?.name}»? Это действие нельзя отменить.
                            Если роль назначена пользователям, удаление будет отклонено.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={deleteRole.isPending}
                            className="bg-red-600 hover:bg-red-700 rounded-lg"
                        >
                            {deleteRole.isPending ? 'Удаление...' : 'Удалить'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default RolesList;