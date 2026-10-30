
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setIsOpen(false); }
      if (event.key !== 'Tab' || !panel.current) return;
      const buttons = Array.from(panel.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey, true);
      previousFocus?.focus();
    };
  }, [isOpen]);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Monday start
  };

  const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const isSameDay = (dateStr: string, date: Date) => dateStr === formatDate(date);

  const isWithinRange = (date: Date) => {
    if (!startDate) return false;
    const d = date.getTime();
    const s = new Date(`${startDate}T00:00:00`).getTime();

    if (endDate) {
      const e = new Date(`${endDate}T00:00:00`).getTime();
      return d > s && d < e;
    }

    if (hoveredDate) {
      const h = new Date(`${hoveredDate}T00:00:00`).getTime();
      if (h > s) {
        return d > s && d < h;
      }
    }

    return false;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleDateClick = (date: Date) => {
    const dateStr = formatDate(date);
    if (!startDate || (startDate && endDate)) {
      onChange(dateStr, '');
    } else {
      const start = new Date(`${startDate}T00:00:00`);
      if (date < start) {
        onChange(dateStr, '');
      } else if (dateStr === startDate) {
        onChange('', '');
      } else {
        onChange(startDate, dateStr);
        setIsOpen(false); // Close modal when range is complete
      }
    }
  };

  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));

  const renderSingleMonth = (baseDate: Date) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayIndex = getFirstDayOfMonth(year, month);

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`empty-${year}-${month}-${i}`} className="h-11 w-full" />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = formatDate(date);
      const isSelectedStart = isSameDay(startDate, date);
      const isSelectedEnd = isSameDay(endDate, date);
      const inRange = isWithinRange(date);
      const past = isPast(date);
      const today = isToday(date);

      const isRangeStart = isSelectedStart && (endDate || (hoveredDate && new Date(`${hoveredDate}T00:00:00`) > new Date(`${startDate}T00:00:00`)));
      const isRangeEnd = isSelectedEnd || (hoveredDate === dateStr && startDate && !endDate && new Date(`${hoveredDate}T00:00:00`) > new Date(`${startDate}T00:00:00`));

      days.push(
        <div
          key={`day-${year}-${month}-${d}`}
          className="relative h-11 w-full flex items-center justify-center group"
          onMouseEnter={() => !past && setHoveredDate(dateStr)}
          onMouseLeave={() => setHoveredDate(null)}
        >
          {/* Background for range highlight */}
          {(inRange || isRangeStart || isRangeEnd) && (
            <div className={`absolute inset-y-1 w-full transition-all duration-200 ${
              inRange ? 'bg-haven-navy/5' :
              isRangeStart ? 'bg-haven-navy/5 left-1/2 right-0' :
              isRangeEnd ? 'bg-haven-navy/5 left-0 right-1/2' : ''
            }`} />
          )}

          <button
            type="button"
            disabled={past}
            aria-label={date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            aria-pressed={isSelectedStart || isSelectedEnd}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDateClick(date);
            }}
            className={`
              h-11 w-full flex flex-col items-center justify-center text-sm font-semibold transition-all relative z-10 rounded-full
              ${past ? 'text-gray-200 cursor-not-allowed' : 'text-gray-700 hover:bg-haven-navy/10'}
              ${isSelectedStart || isSelectedEnd ? 'bg-haven-navy text-white hover:bg-haven-navy shadow-lg scale-110' : ''}
              ${inRange ? 'text-haven-navy font-bold' : ''}
              ${today && !isSelectedStart && !isSelectedEnd ? 'border border-haven-navy/20' : ''}
            `}
          >
            {d}
            {today && !isSelectedStart && !isSelectedEnd && (
              <div className="w-1 h-1 bg-haven-navy rounded-full mt-0.5 absolute bottom-1" />
            )}
          </button>
        </div>
      );
    }

    return (
      <div className="w-full">
        <div className="grid grid-cols-7 text-center mb-1">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => (
            <div key={`${day}-${idx}`} className="h-5 flex items-center justify-center text-[9px] font-bold text-haven-stone/60 uppercase tracking-widest">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 text-center">
          {days}
        </div>
      </div>
    );
  };

  const nextMonthDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);

  return (
    <div className="w-full h-full">
      <button type="button" ref={trigger} aria-haspopup="dialog" aria-expanded={isOpen} aria-label="Choisir les dates du séjour"
        className="flex min-h-11 w-full items-center gap-3 text-left text-gray-600 cursor-pointer group/date h-full"
        onClick={() => setIsOpen(true)}
      >
        <CalendarIcon size={20} className="flex-shrink-0 text-haven-navy group-hover/date:text-haven-red transition-colors duration-300" />
        <div className={`w-full truncate select-none transition-colors duration-300 leading-none ${startDate ? 'text-gray-900 font-bold text-base' : 'text-gray-400 font-bold text-base'}`}>
          {startDate ? (
            <span className="flex items-center gap-1">
              {new Date(`${startDate}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              <span className="text-gray-300 font-normal mx-0.5">→</span>
              {endDate ? new Date(`${endDate}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : "..."}
            </span>
          ) : (
            "Dates de séjour"
          )}
        </div>
      </button>

      {/* MODAL OVERLAY - Rendered in a Portal to ensure viewport centering */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop avec flou */}
          <div
            className="absolute inset-0 bg-haven-navy/20 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Content */}
          <div ref={panel} role="dialog" aria-modal="true" aria-label="Dates du séjour" tabIndex={-1}
            className="relative bg-white w-[calc(100%_-_1rem)] max-w-[560px] max-h-[calc(100dvh-2rem)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-y-auto animate-fade-in px-3 pb-4 pt-12 sm:px-6 sm:pb-6 sm:pt-14"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Minimal Navigation Header */}
            <div className="flex items-center justify-between mb-6">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  prevMonth();
                }}
                aria-label="Mois précédent" className="haven-touch-action p-2 hover:bg-gray-100 rounded-full transition-colors text-haven-navy"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="flex gap-4 md:gap-12">
                <h4 className="font-heading font-bold text-sm text-haven-navy min-w-[120px] text-center">
                  {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"][viewDate.getMonth()]} {viewDate.getFullYear()}
                </h4>
                <h4 className="font-heading font-bold text-sm text-haven-navy min-w-[120px] text-center hidden md:block">
                  {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"][nextMonthDate.getMonth()]} {nextMonthDate.getFullYear()}
                </h4>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  nextMonth();
                }}
                aria-label="Mois suivant" className="haven-touch-action p-2 hover:bg-gray-100 rounded-full transition-colors text-haven-navy"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Two Months Calendar View */}
            <div className="flex flex-col md:flex-row gap-8 items-start justify-center">
              <div className="flex-1 w-full">
                {renderSingleMonth(viewDate)}
              </div>
              <div className="flex-1 w-full hidden md:block">
                {renderSingleMonth(nextMonthDate)}
              </div>
            </div>

            {/* Hidden close button for accessibility/fallback */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="haven-touch-action absolute top-1 right-1 p-1.5 text-haven-red hover:bg-haven-red/10 rounded-full transition-all"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
};
