/**
 * Каталог всех правил системы.
 * Группировка по разделам (страницам).
 * Чтобы добавить новое правило — просто добавьте его сюда,
 * UI и валидация подхватят автоматически.
 */
const PERMISSIONS_CATALOG = [
    {
        key: 'departments',
        name: 'Подразделения',
        description: 'Управление структурой подразделений',
        permissions: [
            { key: 'departments.view', name: 'Просмотр', description: 'Видеть список и дерево подразделений' },
            { key: 'departments.create', name: 'Создание', description: 'Создавать новые подразделения' },
            { key: 'departments.update', name: 'Редактирование', description: 'Изменять название и родителя' },
            { key: 'departments.delete', name: 'Удаление', description: 'Удалять подразделения' },
            { key: 'departments.reorder', name: 'Изменение порядка', description: 'Перетаскивать элементы в дереве' },
        ],
    },
    {
        key: 'fires',
        name: 'Пожары',
        description: 'Управление пожарами',
        permissions: [
            { key: 'fires.view', name: 'Просмотр', description: 'Видеть список пожаров' },
            { key: 'fires.create', name: 'Создание', description: 'Добавлять пожары' },
            { key: 'fires.update', name: 'Редактирование', description: 'Изменять пожары' },
            { key: 'fires.delete', name: 'Удаление', description: 'Удалять пожары' },
        ],
    },
    {
        key: 'units',
        name: 'Техника',
        description: 'Управление техникой',
        permissions: [
            { key: 'units.view', name: 'Просмотр', description: 'Видеть технику' },
            { key: 'units.create', name: 'Создание', description: 'Добавлять технику' },
            { key: 'units.update', name: 'Редактирование', description: 'Изменять технику' },
            { key: 'units.delete', name: 'Удаление', description: 'Удалять технику' },
            // ↓ новые правила
            {
                key: 'units.update_status',
                name: 'Изменение статуса',
                description: 'Менять текущий статус техники',
            },
            {
                key: 'units.view_history',
                name: 'История статусов',
                description: 'Просматривать историю изменений статусов',
            },
            {
                key: 'units.manage_dictionaries',
                name: 'Справочники техники',
                description: 'Управление типами техники и статусами',
            },
        ],
    },
    {
        key: 'users',
        name: 'Пользователи',
        description: 'Управление учётными записями',
        permissions: [

            { key: 'users.view_online', name: 'Просмотр онлайна', description: 'Видеть страницу онлайн-пользователей' },
            { key: 'users.view', name: 'Просмотр', description: 'Видеть список пользователей' },
            { key: 'users.create', name: 'Создание', description: 'Создавать пользователей' },
            { key: 'users.update', name: 'Редактирование', description: 'Изменять пользователей' },
            { key: 'users.delete', name: 'Удаление', description: 'Удалять пользователей' },
            { key: 'users.block', name: 'Блокировка', description: 'Блокировать и разблокировать' },
        ],
    },
    {
        key: 'roles',
        name: 'Роли и права',
        description: 'Управление ролями и правилами',
        permissions: [
            { key: 'roles.view', name: 'Просмотр', description: 'Видеть роли' },
            { key: 'roles.create', name: 'Создание', description: 'Создавать роли' },
            { key: 'roles.update', name: 'Редактирование', description: 'Изменять роли' },
            { key: 'roles.delete', name: 'Удаление', description: 'Удалять роли' },
        ],
    },
    {
        key: 'chat',
        name: 'Чат',
        description: 'Модуль обмена сообщениями',
        permissions: [
            { key: 'chat.use', name: 'Использование чата', description: 'Видеть кнопку чата и открывать его' },
            { key: 'chat.create_channel', name: 'Создание каналов', description: 'Создавать группы/каналы' },
            { key: 'chat.update_channel', name: 'Редактирование каналов', description: 'Переименование, описание, аватар, режим только-чтение' },
            { key: 'chat.delete_channel', name: 'Удаление каналов', description: 'Удалять каналы и группы' },
            { key: 'chat.manage_members', name: 'Управление участниками', description: 'Добавлять и удалять участников каналов' },
            { key: 'chat.moderate', name: 'Модерация сообщений', description: 'Удалять любые сообщения, а не только свои' },
            { key: 'chat.manage_profiles', name: 'Управление профилями чата', description: 'Изменять имя и аватар других пользователей в чате' },
        ],
    },
];

// Плоский список ключей — для валидации
const ALL_PERMISSION_KEYS = PERMISSIONS_CATALOG.flatMap((s) =>
    s.permissions.map((p) => p.key)
);

module.exports = { PERMISSIONS_CATALOG, ALL_PERMISSION_KEYS };