import { useState, useMemo } from 'react';
import {
    useUsers,
    useCreateUser,
    useUpdateUser,
    useDeleteUser,
    useBlockUser,
    useUnblockUser,
} from '../../hooks/useUsers';
import { useDepartments } from '../../hooks/useDepartments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '../../hooks/usePermissions';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Loader2,
    Plus,
    Search,
    Edit,
    Trash2,
    User as UserIcon,
    Ban,
    CheckCircle2,
    Lock,
} from 'lucide-react';
import UserForm from '../../components/UserForm';

import { useRoles } from '../../hooks/useRoles';
import { useAuth } from '../../context/AuthContext';



const UsersList = () => {
    const { has } = usePermissions();
    const { data, isLoading, error } = useUsers();
    const { data: deptData } = useDepartments();
    const createUser = useCreateUser();
    const updateUser = useUpdateUser();
    const deleteUser = useDeleteUser();
    const blockUser = useBlockUser();
    const unblockUser = useUnblockUser();

    const { user: currentUser } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [selectedUser, setSelectedUser] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [userToBlock, setUserToBlock] = useState(null);
    const [formError, setFormError] = useState('');

    const { data: rolesData } = useRoles();
    const roles = rolesData?.data || [];
    const roleMap = roles.reduce((acc, r) => { acc[r.code] = r; return acc; }, {});

    const users = data?.data || [];
    const departments = deptData?.data || [];

    const filteredUsers = useMemo(() => {
        return users.filter((u) => {
            const matchesSearch =
                u.username.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRole = roleFilter === 'all' || u.role === roleFilter;
            return matchesSearch && matchesRole;
        });
    }, [users, searchTerm, roleFilter]);

    const handleCreate = () => {
        setSelectedUser(null);
        setFormError('');
        setIsFormOpen(true);
    };

    const handleEdit = (user) => {
        setSelectedUser(user);
        setFormError('');
        setIsFormOpen(true);
    };

    const handleDelete = (id) => {
        setUserToDelete(id);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (userToDelete) {
            deleteUser.mutate(userToDelete, {
                onSuccess: () => {
                    setIsDeleteDialogOpen(false);
                    setUserToDelete(null);
                },
                onError: (err) => {
                    alert(err.response?.data?.error || 'Ошибка удаления');
                },
            });
        }
    };

    const handleBlockClick = (user) => {
        setUserToBlock(user);
    };

    const confirmBlock = () => {
        if (!userToBlock) return;
        const action = userToBlock.is_blocked ? unblockUser : blockUser;
        action.mutate(userToBlock.id, {
            onSuccess: () => setUserToBlock(null),
            onError: (err) => {
                alert(err.response?.data?.error || 'Ошибка операции');
            },
        });
    };

    const handleFormSubmit = (formData) => {
        setFormError('');
        if (selectedUser) {
            updateUser.mutate(
                { id: selectedUser.id, data: formData },
                {
                    onSuccess: () => {
                        setIsFormOpen(false);
                        setSelectedUser(null);
                    },
                    onError: (err) => {
                        setFormError(err.response?.data?.error || 'Ошибка обновления');
                    },
                }
            );
        } else {
            createUser.mutate(formData, {
                onSuccess: () => setIsFormOpen(false),
                onError: (err) => {
                    setFormError(err.response?.data?.error || 'Ошибка создания');
                },
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
                Ошибка загрузки пользователей
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Пользователи</h2>
                    <p className="text-sm text-slate-500">Всего: {filteredUsers.length}</p>
                </div>
                {has('users.create') && (
                <Button
                    onClick={handleCreate}
                    className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg shadow-md"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Добавить пользователя
                </Button>
                    )}
            </div>

            {/* Фильтры */}
            <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Поиск по логину..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 rounded-lg"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                    <option value="all">Все роли</option>
                    {roles
                        .filter((r) => r.code !== 'developer')
                        .map((r) => (
                            <option key={r.code} value={r.code}>{r.name}</option>
                        ))}
                </select>
            </div>

            {/* Таблица */}
            {filteredUsers.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm p-12 text-center text-slate-500">
                    <UserIcon className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                    <p>Нет пользователей</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Логин</TableHead>
                                <TableHead>Роль</TableHead>
                                <TableHead>Подразделения</TableHead>
                                <TableHead>Доступ</TableHead>
                                <TableHead>Статус</TableHead>
                                <TableHead className="text-right">Действия</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">
                                        {user.username}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className="bg-slate-600 text-white dark:bg-zinc-700 dark:text-white dark:border-white/15">
                                            {roleMap[user.role]?.name || user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {user.can_view_all ? (
                                            <span className="text-sm text-slate-500 italic">
                        Все подразделения
                      </span>
                                        ) : user.departments?.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {user.departments.slice(0, 3).map((d) => (
                                                    <Badge
                                                        key={d.id}
                                                        variant="outline"
                                                        className="text-xs"
                                                    >
                                                        {d.name}
                                                    </Badge>
                                                ))}
                                                {user.departments.length > 3 && (
                                                    <span className="text-xs text-slate-500">
                            +{user.departments.length - 3}
                          </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-slate-400">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {user.can_view_all ? (
                                            <Badge className="bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30">
                                                Полный
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-slate-500">
                                                По подразделениям
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {user.role === 'developer' && (
                                            <Badge className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30">
                                                <Lock className="h-3 w-3 mr-1" />
                                                Защищён
                                            </Badge>
                                        )}
                                        {user.is_blocked ? (
                                            <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30">
                                                <Lock className="h-3 w-3 mr-1" />
                                                Заблокирован
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30">
                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                Активен
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {(() => {
                                            const isTargetDeveloper = user.role === 'developer';
                                            const isSelf = user.id === currentUser?.id;
                                            const protectedDev = isTargetDeveloper && !isSelf;

                                            // Редактировать
                                            const canEdit = has('users.update') && !protectedDev;
                                            // Блокировать
                                            const canBlock = has('users.block') && !protectedDev && !isSelf;
                                            // Удалять
                                            const canDelete =
                                                has('users.delete') && !isTargetDeveloper && !isSelf;

                                            return (
                                                <>
                                                    {canEdit ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleEdit(user)}
                                                            className="h-8 w-8 p-0"
                                                            title="Редактировать"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled
                                                            className="h-8 w-8 p-0 opacity-30 cursor-not-allowed"
                                                            title={
                                                                protectedDev
                                                                    ? 'Разработчика может изменить только он сам'
                                                                    : 'Нет прав'
                                                            }
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    )}

                                                    {canBlock ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleBlockClick(user)}
                                                            className={`h-8 w-8 p-0 ${
                                                                user.is_blocked
                                                                    ? 'text-green-600 hover:text-green-700'
                                                                    : 'text-orange-500 hover:text-orange-700'
                                                            }`}
                                                            title={user.is_blocked ? 'Разблокировать' : 'Заблокировать'}
                                                        >
                                                            {user.is_blocked ? (
                                                                <CheckCircle2 className="h-4 w-4" />
                                                            ) : (
                                                                <Ban className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled
                                                            className="h-8 w-8 p-0 opacity-30 cursor-not-allowed"
                                                            title={
                                                                isTargetDeveloper
                                                                    ? 'Разработчика нельзя заблокировать'
                                                                    : isSelf
                                                                        ? 'Нельзя заблокировать самого себя'
                                                                        : 'Нет прав'
                                                            }
                                                        >
                                                            {user.is_blocked ? (
                                                                <CheckCircle2 className="h-4 w-4" />
                                                            ) : (
                                                                <Ban className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    )}

                                                    {canDelete ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(user.id)}
                                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                                            title="Удалить"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled
                                                            className="h-8 w-8 p-0 opacity-30 cursor-not-allowed"
                                                            title={
                                                                isTargetDeveloper
                                                                    ? 'Разработчика нельзя удалить'
                                                                    : isSelf
                                                                        ? 'Нельзя удалить самого себя'
                                                                        : 'Нет прав'
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Форма */}
            <UserForm
                open={isFormOpen}
                onOpenChange={(open) => {
                    setIsFormOpen(open);
                    if (!open) {
                        setFormError('');
                        setSelectedUser(null);
                    }
                }}
                onSubmit={handleFormSubmit}
                initialData={selectedUser}
                isLoading={createUser.isPending || updateUser.isPending}
                error={formError}
                departments={departments}
            />

            {/* Подтверждение удаления */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Удаление пользователя</AlertDialogTitle>
                        <AlertDialogDescription>
                            Вы уверены, что хотите удалить этого пользователя? Все его сессии
                            будут завершены. Это действие нельзя отменить.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={deleteUser.isPending}
                            className="bg-red-600 hover:bg-red-700 rounded-lg"
                        >
                            {deleteUser.isPending ? 'Удаление...' : 'Удалить'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Подтверждение блокировки / разблокировки */}
            <AlertDialog
                open={!!userToBlock}
                onOpenChange={(open) => !open && setUserToBlock(null)}
            >
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {userToBlock?.is_blocked
                                ? 'Разблокировать пользователя'
                                : 'Заблокировать пользователя'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {userToBlock?.is_blocked
                                ? `Разблокировать пользователя "${userToBlock?.username}"? Он сможет снова войти в систему.`
                                : `Заблокировать пользователя "${userToBlock?.username}"? Все его активные сессии будут завершены, и он не сможет войти.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-lg">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmBlock}
                            disabled={blockUser.isPending || unblockUser.isPending}
                            className={
                                userToBlock?.is_blocked
                                    ? 'bg-green-600 hover:bg-green-700 rounded-lg'
                                    : 'bg-orange-600 hover:bg-orange-700 rounded-lg'
                            }
                        >
                            {blockUser.isPending || unblockUser.isPending
                                ? '...'
                                : userToBlock?.is_blocked
                                    ? 'Разблокировать'
                                    : 'Заблокировать'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default UsersList;