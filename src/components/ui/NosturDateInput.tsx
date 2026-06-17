import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";

type NosturDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

type NosturDateRangePickerProps = {
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  min?: string;
  max?: string;
  disabledEnd?: boolean;
  startLabel?: string;
  endLabel?: string;
};

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

const WEEK_DAYS = ["L", "M", "M", "J", "V", "S", "D"];

function getToday(): string {
  const now = new Date();
  const argentinaNow = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Argentina/Cordoba" })
  );

  const year = argentinaNow.getFullYear();
  const month = String(argentinaNow.getMonth() + 1).padStart(2, "0");
  const day = String(argentinaNow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createDateFromStorage(value?: string | null): Date {
  if (!value) return createDateFromStorage(getToday());

  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  if (!year || !month || !day) return createDateFromStorage(getToday());

  return new Date(year, month - 1, day);
}

function formatCalendarStorageDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toDisplayDate(value?: string | null): string {
  if (!value) return "";

  const clean = value.slice(0, 10);
  const [year, month, day] = clean.split("-");

  if (!year || !month || !day) return "";

  return `${day}/${month}/${year}`;
}

function toStorageDate(value: string): string {
  const clean = value.trim();

  if (!clean) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  const match = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) return "";

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3];

  return `${year}-${month}-${day}`;
}

function formatDateInputMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function getCalendarDays(monthDate: Date): Date[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstWeekDay = (firstDay.getDay() + 6) % 7;
  const days: Date[] = [];

  for (let index = firstWeekDay - 1; index >= 0; index -= 1) {
    days.push(new Date(year, month, -index));
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) {
    const next = days.length - firstWeekDay - lastDay.getDate() + 1;
    days.push(new Date(year, month + 1, next));
  }

  return days;
}

function isBeforeMin(value: string, min?: string): boolean {
  if (!value || !min) return false;
  return value < min;
}

function isAfterMax(value: string, max?: string): boolean {
  if (!value || !max) return false;
  return value > max;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">
      {children}
    </label>
  );
}

export function NosturDateInput({
  value,
  onChange,
  min,
  max,
  placeholder = "dd/mm/aaaa",
  disabled = false,
  className = ""
}: NosturDateInputProps) {
  const [open, setOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState(() => toDisplayDate(value));
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => createDateFromStorage(value || min));

  useEffect(() => {
    setDisplayValue(toDisplayDate(value));

    if (value) {
      setVisibleMonth(createDateFromStorage(value));
    }
  }, [value]);

  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const selectedValue = value ? value.slice(0, 10) : "";
  const currentMonth = visibleMonth.getMonth();

  function commit(nextDisplayValue: string) {
    const storageValue = toStorageDate(nextDisplayValue);

    if (!storageValue) {
      onChange("");
      return;
    }

    if (isBeforeMin(storageValue, min)) {
      onChange(min || "");
      setDisplayValue(toDisplayDate(min));
      return;
    }

    if (isAfterMax(storageValue, max)) {
      onChange(max || "");
      setDisplayValue(toDisplayDate(max));
      return;
    }

    onChange(storageValue);
  }

  function selectDate(date: Date) {
    const storageValue = formatCalendarStorageDate(date);

    if (isBeforeMin(storageValue, min) || isAfterMax(storageValue, max)) return;

    onChange(storageValue);
    setDisplayValue(toDisplayDate(storageValue));
    setOpen(false);
  }

  function goToPreviousMonth() {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  function clearDate() {
    onChange("");
    setDisplayValue("");
    setOpen(false);
  }

  return (
    <div className={["relative", open ? "z-[160]" : "z-0", className].join(" ")}>
      <div
        className={[
          "flex h-10 items-center gap-2 rounded-xl border border-black/10 bg-[#f8fafc] px-3 transition focus-within:border-nostur-orange",
          disabled ? "cursor-not-allowed opacity-60" : ""
        ].join(" ")}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          className="flex shrink-0 items-center justify-center text-[#64748b] hover:text-nostur-orange disabled:hover:text-[#64748b]"
        >
          <CalendarDays size={15} strokeWidth={1.8} />
        </button>

        <input
          value={displayValue}
          disabled={disabled}
          onFocus={() => !disabled && setOpen(true)}
          onChange={(event) => {
            const masked = formatDateInputMask(event.target.value);
            setDisplayValue(masked);

            if (masked.length === 10) commit(masked);
            if (masked.length === 0) onChange("");
          }}
          onBlur={() => {
            if (displayValue.length > 0 && displayValue.length < 10) {
              setDisplayValue(toDisplayDate(value));
            }
          }}
          placeholder={placeholder}
          inputMode="numeric"
          className="h-full min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#111827] outline-none placeholder:text-[#94a3b8] disabled:cursor-not-allowed"
        />

        {value && !disabled ? (
          <button
            type="button"
            onClick={clearDate}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[#94a3b8] hover:bg-white hover:text-red-600"
          >
            <X size={12} />
          </button>
        ) : null}
      </div>

      {open && !disabled ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setOpen(false)}
            tabIndex={-1}
          />

          <div className="absolute left-0 top-[44px] z-[170] w-[292px] rounded-2xl border border-black/10 bg-white p-3 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={goToPreviousMonth}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-[#f8fafc] hover:text-[#111827]"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="text-xs font-black uppercase tracking-[0.12em] text-[#111827]">
                {MONTH_NAMES[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
              </div>

              <button
                type="button"
                onClick={goToNextMonth}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-[#f8fafc] hover:text-[#111827]"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1">
              {WEEK_DAYS.map((day, index) => (
                <div
                  key={`${day}-${index}`}
                  className="flex h-7 items-center justify-center text-[10px] font-black text-[#94a3b8]"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date) => {
                const storageValue = formatCalendarStorageDate(date);
                const isSelected = storageValue === selectedValue;
                const isOtherMonth = date.getMonth() !== currentMonth;
                const isDisabled = isBeforeMin(storageValue, min) || isAfterMax(storageValue, max);
                const isToday = storageValue === getToday();

                return (
                  <button
                    key={storageValue}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => selectDate(date)}
                    className={[
                      "flex h-8 items-center justify-center rounded-xl text-[11px] font-black transition",
                      isSelected
                        ? "bg-nostur-orange text-white shadow-sm"
                        : isDisabled
                          ? "cursor-not-allowed text-[#cbd5e1]"
                          : isToday
                            ? "bg-nostur-orange/10 text-nostur-orange hover:bg-nostur-orange/20"
                            : isOtherMonth
                              ? "text-[#cbd5e1] hover:bg-[#f8fafc]"
                              : "text-[#334155] hover:bg-[#f8fafc]"
                    ].join(" ")}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function NosturDateRangePicker({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  min,
  max,
  disabledEnd = false,
  startLabel = "Desde",
  endLabel = "Hasta"
}: NosturDateRangePickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-nostur-orange/20 bg-white/70 p-2">
      <div>
        <FieldLabel>{startLabel}</FieldLabel>
        <NosturDateInput
          value={startValue}
          onChange={(value: string) => {
            onStartChange(value);

            if (endValue && value && endValue < value) {
              onEndChange(value);
            }
          }}
          min={min}
          max={max}
        />
      </div>

      {!disabledEnd ? (
        <div>
          <FieldLabel>{endLabel}</FieldLabel>
          <NosturDateInput
            value={endValue}
            onChange={(value: string) => onEndChange(value)}
            min={startValue || min}
            max={max}
          />
        </div>
      ) : (
        <div>
          <FieldLabel>{endLabel}</FieldLabel>
          <div className="flex h-10 items-center rounded-xl border border-black/10 bg-[#f8fafc] px-3 text-xs font-bold text-[#94a3b8]">
            Solo ida
          </div>
        </div>
      )}
    </div>
  );
}

export default NosturDateInput;