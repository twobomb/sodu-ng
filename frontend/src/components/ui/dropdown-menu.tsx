import * as React from "react";
import { cn } from "@/lib/utils";

// Контекст для передачи setOpen в дочерние элементы
const DropdownContext = React.createContext({ setOpen: () => {} });

const DropdownMenu = ({ children }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
      <DropdownContext.Provider value={{ setOpen }}>
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
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (e) => {
        children.props.onClick?.(e);
        setOpen(!open);
      },
    });
  }
  return <button onClick={() => setOpen(!open)}>{children}</button>;
};

const DropdownMenuContent = ({ children, open, className, align = "start" }) => {
  if (!open) return null;

  const alignClass = align === "end" ? "right-0" : "left-0";

  return (
      <div
          className={cn(
              "absolute top-full mt-2 min-w-[220px] z-50",
              alignClass,
              "bg-white/95 backdrop-blur-sm rounded-xl",
              "shadow-xl shadow-slate-200/50 ring-1 ring-slate-900/5",
              "border border-slate-100",
              "py-1.5 overflow-hidden",
              className
          )}
          style={{
            animation: "dropdownIn 0.15s ease-out",
          }}
      >
        {children}
        <style>{`
        @keyframes dropdownIn {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
      </div>
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
          onClick={handleClick}
          className={cn(
              "group/item w-full flex items-center gap-3 px-3 py-2 mx-1.5 rounded-lg",
              "text-sm font-medium text-left transition-all duration-150",
              danger
                  ? "text-red-600 hover:bg-red-50 hover:text-red-700"
                  : "text-slate-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 hover:text-orange-700",
              "focus:outline-none",
              className
          )}
          style={{ width: "calc(100% - 12px)" }}
      >
        {Icon && (
            <Icon
                className={cn(
                    "h-4 w-4 transition-transform duration-150 group-hover/item:scale-110",
                    danger ? "text-red-500" : "text-slate-400 group-hover/item:text-orange-500"
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