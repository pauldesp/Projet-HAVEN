
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { BookingAvailability } from '../types';
import { Button } from './Button';

interface ListingCalendarProps {
  activeRoomBookings: BookingAvailability[];
  allHouseBookings: BookingAvailability[];
  onDateSelect: (start: string, end: string) => void;
  selectedStart: string;
  selectedEnd: string;
  isOwner?: boolean;
  blockedDates?: string[];
  listingBlockedDates?: string[];
  onSaveBlockedDates?: (dates: string[]) => Promise<void>;
}

export const ListingCalendar: React.FC<ListingCalendarProps> = ({ 
  activeRoomBookings, 
  allHouseBookings,
  onDateSelect,
  selectedStart,
  selectedEnd,
  isOwner = false,
  blockedDates = [],
  listingBlockedDates = [],
  onSaveBlockedDates
}) => {
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [manualBlockedDates, setManualBlockedDates] = useState<string[]>(blockedDates);
  
  const today = new Date();
  const isToday = (year: number, month: number, day: number) => {
    return today.getFullYear() === year && 
           today.getMonth() === month && 
           today.getDate() === day;
  };
  
  const [isBlockingMode, setIsBlockingMode] = useState(false);
  const [tempBlockedDates, setTempBlockedDates] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ... rest of the component ...

  // Utilitaires de dates
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const isRoomBooked = (year: number, month: number, day: number) => {
    const checkDate = new Date(year, month, day).setHours(0,0,0,0);
    const hasBooking = activeRoomBookings.some(b => {
      const start = new Date(b.startDate).setHours(0,0,0,0);
      const end = new Date(b.endDate).setHours(0,0,0,0);
      return checkDate >= start && checkDate <= end;
    });

    if (hasBooking) return true;

    const dateStr = new Date(year, month, day + 1).toISOString().split('T')[0];
    return manualBlockedDates.includes(dateStr) || listingBlockedDates.includes(dateStr);
  };

  const isDateManuallyBlocked = (year: number, month: number, day: number) => {
    const dateStr = new Date(year, month, day + 1).toISOString().split('T')[0];
    return manualBlockedDates.includes(dateStr) || listingBlockedDates.includes(dateStr);
  };

  const getTenantsOnDate = (year: number, month: number, day: number) => {
    const checkDate = new Date(year, month, day).setHours(0,0,0,0);
    return allHouseBookings.filter(b => {
      const start = new Date(b.startDate).setHours(0,0,0,0);
      const end = new Date(b.endDate).setHours(0,0,0,0);
      return checkDate >= start && checkDate <= end;
    });
  };

  const isDateSelected = (year: number, month: number, day: number) => {
    if (!selectedStart) return false;
    const checkDate = new Date(year, month, day).setHours(0,0,0,0);
    const start = new Date(selectedStart).setHours(0,0,0,0);
    if (!selectedEnd) return checkDate === start;
    const end = new Date(selectedEnd).setHours(0,0,0,0);
    return checkDate >= start && checkDate <= end;
  };

  const handleDayClick = (day: number) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const clickedDateStr = new Date(year, month, day + 1).toISOString().split('T')[0];

    if (isOwner) {
      if (!isBlockingMode) return;

      const hasRealBooking = activeRoomBookings.some(b => {
        const checkDate = new Date(year, month, day).setHours(0,0,0,0);
        const start = new Date(b.startDate).setHours(0,0,0,0);
        const end = new Date(b.endDate).setHours(0,0,0,0);
        return checkDate >= start && checkDate <= end;
      });

      if (hasRealBooking) return;

      if (tempBlockedDates.includes(clickedDateStr)) {
        setTempBlockedDates(tempBlockedDates.filter(d => d !== clickedDateStr));
      } else {
        setTempBlockedDates([...tempBlockedDates, clickedDateStr]);
      }
      return;
    }

    if (isRoomBooked(year, month, day)) return;

    if (!selectedStart || (selectedStart && selectedEnd)) {
      onDateSelect(clickedDateStr, '');
    } else {
      const start = new Date(selectedStart);
      const end = new Date(clickedDateStr);
      if (end < start) {
        onDateSelect(clickedDateStr, '');
        return;
      }
      onDateSelect(selectedStart, clickedDateStr);
    }
  };

  const toggleBlockingMode = () => {
    if (isBlockingMode) {
      setIsBlockingMode(false);
      setTempBlockedDates([]);
      setShowConfirm(false);
    } else {
      setIsBlockingMode(true);
      setTempBlockedDates([...manualBlockedDates]);
    }
  };

  const handleConfirmBlocks = async () => {
    if (!onSaveBlockedDates) return;
    setIsSaving(true);
    try {
      await onSaveBlockedDates(tempBlockedDates);
      setManualBlockedDates(tempBlockedDates);
      setIsBlockingMode(false);
      setShowConfirm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayIndex = getFirstDayOfMonth(currentDate);
  const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  return (
    <>
      <div className={`bg-white rounded-2xl border ${isBlockingMode ? 'border-haven-red ring-2 ring-haven-red/10' : 'border-gray-100'} p-6 shadow-sm transition-all overflow-hidden relative`}>
        
        {isBlockingMode && (
          <div className="absolute inset-0 bg-haven-red/[0.02] pointer-events-none z-0"></div>
        )}

        <div className="flex justify-between items-center mb-6 relative z-10">
          <div className="flex flex-col">
            <h3 className="font-heading font-bold text-lg text-haven-navy capitalize">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            {isBlockingMode && (
              <span className="text-[10px] font-black uppercase text-haven-red animate-pulse">Mode Blocage Actif</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {isOwner && (
              <div className="flex gap-2">
                {!isBlockingMode ? (
                  <button 
                    onClick={toggleBlockingMode}
                    className="bg-haven-red text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-haven-red/90 transition-all flex items-center gap-2"
                  >
                    <Lock size={14} /> Bloquer des dates
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => setShowConfirm(true)}
                      disabled={isSaving}
                      className="bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-green-600 transition-all disabled:opacity-50"
                    >
                      {isSaving ? "Enregistrement..." : "Valider"}
                    </button>
                    <button 
                      onClick={toggleBlockingMode}
                      disabled={isSaving}
                      className="bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 rounded-full hover:bg-gray-300 transition-all disabled:opacity-50"
                    >
                      Annuler
                    </button>
                  </>
                )}
              </div>
            )}
            
            <div className="flex gap-2 text-[10px] font-bold items-center pr-4">
              <div className="flex items-center gap-1.5 mr-3 text-gray-400">
                <div className="w-2.5 h-2.5 rounded-full bg-white border border-gray-200"></div>
                <span>Libre</span>
              </div>
              <div className="flex items-center gap-1.5 text-haven-red font-black">
                <div className="w-2.5 h-2.5 rounded-full bg-haven-red/10 border border-haven-red/20"></div>
                <span>Bloqué</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button onClick={prevMonth} className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
                <ChevronLeft size={20} />
              </button>
              <button onClick={nextMonth} className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Modal de confirmation interne */}
        {showConfirm && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 backdrop-blur-sm bg-white/60">
            <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 p-8 max-w-sm text-center animate-fade-in-up">
              <div className="w-16 h-16 bg-haven-red/10 text-haven-red rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock size={32} />
              </div>
              <h4 className="text-xl font-bold text-haven-navy mb-2">Confirmer le blocage ?</h4>
              <p className="text-gray-500 text-sm mb-6">
                Voulez-vous vraiment modifier les dates indisponibles pour ce logement ?
              </p>
              <div className="flex gap-3">
                <Button fullWidth onClick={handleConfirmBlocks} disabled={isSaving}>Confirmer</Button>
                <Button fullWidth variant="outline" onClick={() => setShowConfirm(false)} disabled={isSaving}>Annuler</Button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-7 gap-2 mb-2 text-center relative z-10">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
            <div key={d} className="text-xs font-bold text-gray-400 uppercase">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {[...Array(firstDayIndex)].map((_, i) => <div key={`empty-${i}`} />)}

          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1;
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const dateStr = new Date(year, month, day + 1).toISOString().split('T')[0];
            
            const isBooked = isRoomBooked(year, month, day);
            const isManualBlocked = isBlockingMode 
              ? tempBlockedDates.includes(dateStr) 
              : manualBlockedDates.includes(dateStr) || listingBlockedDates.includes(dateStr);

            const isSelected = isDateSelected(year, month, day);
            const tenants = getTenantsOnDate(year, month, day);
            const dateKey = `${year}-${month}-${day}`;

            return (
              <div 
                key={day} 
                className="relative group"
                onMouseEnter={() => setHoveredDate(dateKey)}
                onMouseLeave={() => setHoveredDate(null)}
              >
                <button
                  disabled={isBooked && !isOwner}
                  onClick={() => handleDayClick(day)}
                  className={`
                    h-14 w-full rounded-xl text-sm font-medium flex flex-col items-center justify-start pt-1.5 transition-all relative border overflow-visible
                    ${isToday(year, month, day) && !isSelected ? 'border-haven-red/30 bg-haven-red/[0.02]' : ''}
                    ${isBlockingMode && tempBlockedDates.includes(dateStr)
                      ? 'bg-haven-red/20 text-haven-red border-haven-red shadow-sm scale-105 z-10'
                      : isBooked 
                        ? isManualBlocked
                          ? 'bg-haven-red/5 text-haven-red/40 border-haven-red/10 cursor-pointer hover:bg-haven-red/10'
                          : 'bg-gray-50 text-gray-400 border-transparent cursor-not-allowed opacity-60' 
                        : isSelected 
                          ? 'bg-haven-navy text-white border-haven-navy shadow-md z-10' 
                          : 'bg-white border-gray-100 hover:border-haven-navy/50 text-gray-700'
                    }
                    ${isBlockingMode && !tempBlockedDates.includes(dateStr) ? 'hover:bg-haven-red/5' : ''}
                  `}
                >
                  <span className={`z-10 ${isToday(year, month, day) ? 'font-black relative after:content-[""] after:absolute after:-bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-haven-red after:rounded-full' : ''}`}>
                    {day}
                  </span>
                  
                  {isManualBlocked && (
                    <div className="absolute top-1 right-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-haven-red"></div>
                    </div>
                  )}
                  
                  {tenants.length > 0 && (
                    <div className="flex -space-x-2 mt-0.5 relative z-20 justify-center w-full px-1">
                      {tenants.slice(0, 3).map((booking, idx) => (
                        <div key={idx} className={`w-5 h-5 rounded-full border-2 overflow-hidden flex-shrink-0 ${isSelected ? 'border-haven-navy' : 'border-white'}`}>
                          <div className="w-full h-full bg-gray-300" />
                        </div>
                      ))}
                      {tenants.length > 3 && (
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[8px] font-bold flex-shrink-0 ${isSelected ? 'bg-white text-haven-navy border-haven-navy' : 'bg-gray-100 text-gray-600 border-white'}`}>
                          +{tenants.length - 3}
                        </div>
                      )}
                    </div>
                  )}
                </button>

                {/* Public occupancy summary: no tenant identity is exposed. */}
                {hoveredDate === dateKey && tenants.length > 0 && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50 animate-fade-in-up">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex justify-between items-center">
                      Occupations confirmées
                    </h4>
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {tenants.map((booking) => (
                        <div 
                          key={booking.id} 
                          className="flex items-center gap-3 p-1.5 rounded-lg"
                        >
                          <div className="relative flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gray-200 border border-gray-200 flex items-center justify-center"><Lock size={14} /></div>
                          </div>
                          <div className="text-left flex-1">
                            <p className="text-sm font-bold text-haven-navy">Occupation confirmée</p>
                            <p className="text-[10px] text-gray-500 line-clamp-1">
                              Chambre indisponible à cette date
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-white"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
