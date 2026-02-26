import * as React from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  trigger: React.ReactElement;
  children: React.ReactNode;
  align?: "start" | "end" | "center";
}

function DropdownMenu({ trigger, children, align = "end" }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const clonedTrigger = React.cloneElement(trigger, {
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      trigger.props.onClick?.(e);
      setOpen((o) => !o);
    },
  });

  return (
    <div ref={ref} className="relative inline-block">
      {clonedTrigger}
      {open && (
        <DropdownCloseCtx.Provider value={() => setOpen(false)}>
          <div
            className={cn(
              "absolute z-50 mt-1 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
              align === "end" && "right-0",
              align === "start" && "left-0",
              align === "center" && "left-1/2 -translate-x-1/2",
            )}
          >
            {children}
          </div>
        </DropdownCloseCtx.Provider>
      )}
    </div>
  );
}

const DropdownCloseCtx = React.createContext<(() => void) | null>(null);

function DropdownMenuItem({
  className,
  onClick,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { onClick?: (e: React.MouseEvent) => void }) {
  const close = React.useContext(DropdownCloseCtx);
  return (
    <div
      role="menuitem"
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
        close?.();
      }}
      {...props}
    />
  );
}

export { DropdownMenu, DropdownMenuItem };
