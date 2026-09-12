import { useEffect, useRef } from 'react';

const EMOJI_GROUPS = [
    {
        name: 'Смайлы',
        emojis: [
            '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰',
            '😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏',
            '😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠',
        ],
    },
    {
        name: 'Жесты',
        emojis: [
            '👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️',
            '🖖','👋','🤝','🙏','💪','🦾','✍️','💅','🤳',
        ],
    },
    {
        name: 'Символы',
        emojis: [
            '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
            '💘','💝','💟','☮️','✨','⭐','🌟','💫','⚡','🔥','💥','✅','❌','❗','❓','💯',
        ],
    },
    {
        name: 'Пожарная тема',
        emojis: ['🔥','🚒','🧯','🚨','⛑️','🧑‍🚒','👨‍🚒','👩‍🚒','🏠','🌲','💧','🌊','🚁','📞','🗺️','📻'],
    },
];

const EmojiPicker = ({ onSelect, onClose }) => {
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    return (
        <div
            ref={ref}
            className="absolute bottom-12 left-0 w-[300px] max-h-[340px] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-30"
        >
            <div className="overflow-y-auto max-h-[340px] p-2">
                {EMOJI_GROUPS.map((group) => (
                    <div key={group.name} className="mb-2">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 px-1 py-1">
                            {group.name}
                        </div>
                        <div className="grid grid-cols-8 gap-0.5">
                            {group.emojis.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => onSelect(emoji)}
                                    className="h-8 text-lg hover:bg-slate-100 rounded transition-colors"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EmojiPicker;