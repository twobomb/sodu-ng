import { Code2 } from 'lucide-react';

/**
 * Отображает имя пользователя в чате.
 * Если системная роль — developer, добавляет градиент и иконку.
 */
const DisplayName = ({ name, role, isOwn = false, size = 'md' }) => {
    const isDeveloper = role === 'developer';

    // Размер: системные имена меньше, чтобы не сливались с текстом сообщения.
    const sizeCls =
        size === 'sm'
            ? 'text-[11px]'
            : size === 'lg'
                ? 'text-sm'
                : 'text-xs';

    if (!isDeveloper) {
        // Обычный пользователь: полужирный, меньшего размера и другого цвета,
        // чем тело сообщения (text-slate-800 text-sm), чтобы имя явно читалось
        // как «заголовок» и не визуально сливалось с текстом.
        return (
            <span
                className={`font-semibold ${sizeCls} ${
                    isOwn ? 'text-white/90' : 'text-slate-500'
                }`}
            >
                {name}
            </span>
        );
    }

    // Для developer — градиентный текст + иконка
    const devSizeCls =
        size === 'sm'
            ? 'text-[11px]'
            : size === 'lg'
                ? 'text-sm'
                : 'text-xs';

    return (
        <span
            className={`inline-flex items-center gap-1 font-semibold ${devSizeCls} ${
                isOwn ? 'text-white/95' : ''
            }`}
            title="Разработчик"
        >
      <Code2
          className={`h-3 w-3 flex-shrink-0 ${
              isOwn ? 'text-white' : 'text-purple-600'
          }`}
      />
      <span
          className={
              isOwn
                  ? 'text-white'
                  : 'bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 bg-clip-text text-transparent'
          }
      >
        {name}
      </span>
    </span>
    );
};

export default DisplayName;