import type { ComponentType, MouseEvent } from "react";

type IconButtonProps = {
  icon: ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  label: string;
  onClick?: (event: MouseEvent<HTMLSpanElement>) => void;
  disabled?: boolean;
  className?: string;
  iconClassName?: string;
  tooltipPosition?: "top" | "bottom";
};

export function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  className = "",
  iconClassName = "",
  tooltipPosition = "top"
}: IconButtonProps) {
  return (
    <span
      role="button"
      tabIndex={disabled ? -1 : 0}
      title={label}
      aria-label={label}
      aria-disabled={disabled}
      onClick={(event) => {
        if (disabled) return;
        onClick?.(event);
      }}
      className={[
        "group relative flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] transition hover:bg-white hover:text-[#111827]",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        className
      ].join(" ")}
    >
      <Icon size={14} strokeWidth={1.8} className={iconClassName} />

      <span
        className={[
          "pointer-events-none absolute left-1/2 z-[500] hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#111827] px-2 py-1 text-[10px] font-bold text-white shadow-xl group-hover:block",
          tooltipPosition === "top"
            ? "bottom-[calc(100%+8px)]"
            : "top-[calc(100%+8px)]"
        ].join(" ")}
      >
        {label}
      </span>
    </span>
  );
}