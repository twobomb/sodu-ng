import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

const DropdownContext = React.createContext({
  setOpen: () => {},
  triggerRef: { current: null },
  contentRef: { current: null },
  open: false,
});

const DropdownMenu = ({ children }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const triggerRef = React.useRef(null);
  const contentRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      // Игнорируем клик, если он внутри триггера или внутри попапа
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (contentRef.current && contentRef.current.contains(e.target)) return;
      if (ref.current && ref.current.contains(e.target)) return;
      setOpen(false);
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  return (
      <DropdownContext.Provider value={{ setOpen, triggerRef, contentRef, open }}>
        <div ref={ref} className="relative">
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child, { open, setOpen });
            }
            return child;
          })}
        </div>
      </DropdownContext.Provider>
  );
};

const DropdownMenuTrigger = ({ children, open, setOpen, asChild }) => {
  const { triggerRef } = React.useContext(DropdownContext);

  const handleClick = (e) => {
    children.props?.onClick?.(e);
    setOpen(!open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ref: triggerRef,
      onClick: handleClick,
    });
  }
  return (
      <button ref={triggerRef} onClick={handleClick}>
        {children}
      </button>
  );
};

const DropdownMenuContent = ({
                               children,
                               open,
                               className,
                               align = 'start',
                               sideOffset = 4,
                             }) => {
  const { triggerRef, contentRef } = React.useContext(DropdownContext);
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });

  React.useEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const contentWidth = contentRef.current?.offsetWidth || 200;
      const contentHeight = contentRef.current?.offsetHeight || 200;

      let top = rect.bottom + sideOffset;
      let left = align === 'end' ? rect.right - contentWidth : rect.left;

      // Если не влезает снизу — показываем сверху
      if (top + contentHeight > window.innerHeight - 8) {
        top = rect.top - contentHeight - sideOffset;
      }

      // Горизонтальная коррекция
      if (left < 8) left = 8;
      if (left + contentWidth > window.innerWidth - 8) {
        left = window.innerWidth - contentWidth - 8;
      }

      setCoords({ top, left });
    };

    updatePosition();
    const raf = requestAnimationFrame(updatePosition);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, align, sideOffset, triggerRef, contentRef]);

  if (!open) return null;

  return createPortal(
      <div
          ref={contentRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
          }}
          className={cn(
              'min-w-[200px] z-[9999]',
              'bg-white/95 backdrop-blur-sm rounded-xl',
              'shadow-xl shadow-slate-200/50 ring-1 ring-slate-900/5',
              'border border-slate-100 py-1.5',
              className
          )}
      >
        {children}
        <style>{`
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      </div>,
      document.body
  );
};

const DropdownMenuItem = ({ children, onClick, className, icon: Icon, danger }) => {
  const { setOpen } = React.useContext(DropdownContext);

  const handleClick = () => {
    onClick?.();
    setOpen(false);
  };

  return (
      <button
          type="button"
          onClick={handleClick}
          className={cn(
              'group/item w-full flex items-center gap-3 px-3 py-2 mx-1.5 rounded-lg',
              'text-sm font-medium text-left transition-all duration-150',
              danger
                  ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                  : 'text-slate-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 hover:text-orange-700',
              'focus:outline-none'
          )}
          style={{ width: 'calc(100% - 12px)' }}
      >
        {Icon && (
            <Icon
                className={cn(
                    'h-4 w-4 transition-transform duration-150 group-hover/item:scale-110',
                    danger
                        ? 'text-red-500'
                        : 'text-slate-400 group-hover/item:text-orange-500'
                )}
            />
        )}
        <span className="flex-1">{children}</span>
      </button>
  );
};

const DropdownMenuSeparator = () => (
    <div className="my-1.5 mx-3 border-t border-slate-100" />
);

const DropdownMenuLabel = ({ children }) => (
    <div className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
      {children}
    </div>
);

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};