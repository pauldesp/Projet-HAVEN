import React, { useEffect, useRef, useState } from 'react';
import { BirthDateParts, birthDateFromParts, parsePastedBirthDate, partsFromBirthDate, updateBirthDatePart } from '../services/birthDateEntry';
import { isValidPastBirthDate } from '../services/profileVerification';

interface BirthDateInputProps {
  value: string;
  onChange: (value: string) => void;
}

/** Three native text fields let the iPad keyboard advance without opening the date picker. */
export const BirthDateInput: React.FC<BirthDateInputProps> = ({ value, onChange }) => {
  const [parts, setParts] = useState<BirthDateParts>(() => partsFromBirthDate(value));
  const lastEmitted = useRef(value);
  const fields = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    setParts(partsFromBirthDate(value));
    lastEmitted.current = value;
  }, [value]);

  const emit = (next: BirthDateParts) => {
    const date = birthDateFromParts(next);
    lastEmitted.current = date;
    onChange(date);
  };

  const edit = (index: 0 | 1 | 2, raw: string) => {
    const result = updateBirthDatePart(parts, index, raw);
    setParts(result.parts);
    emit(result.parts);
    if (result.advance) {
      fields.current[index + 1]?.focus();
      fields.current[index + 1]?.select();
    }
  };

  const paste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const parsed = parsePastedBirthDate(event.clipboardData.getData('text'));
    if (!parsed) return;
    event.preventDefault();
    setParts(parsed);
    emit(parsed);
    fields.current[2]?.focus();
  };

  const invalid = Boolean(birthDateFromParts(parts)) && !isValidPastBirthDate(birthDateFromParts(parts));
  const fieldClass = 'w-full min-w-0 bg-transparent text-center text-sm font-normal text-haven-navy outline-none placeholder:text-gray-400';

  return (
    <div>
      <div className={`mt-1.5 flex w-full items-center rounded-xl border bg-white px-3 py-2.5 transition focus-within:border-haven-navy focus-within:ring-2 focus-within:ring-haven-navy/10 ${invalid ? 'border-red-300' : 'border-gray-200'}`}>
        <input ref={element => { fields.current[0] = element; }} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} autoComplete="bday-day" aria-label="Jour de naissance" aria-invalid={invalid} placeholder="JJ" value={parts[0]} onFocus={event => event.currentTarget.select()} onChange={event => edit(0, event.target.value)} onPaste={paste} onKeyDown={event => { if (event.key === 'ArrowRight' && event.currentTarget.selectionStart === parts[0].length) fields.current[1]?.focus(); }} className={`${fieldClass} max-w-9`} />
        <span aria-hidden="true" className="px-1 text-gray-400">/</span>
        <input ref={element => { fields.current[1] = element; }} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} autoComplete="bday-month" aria-label="Mois de naissance" aria-invalid={invalid} placeholder="MM" value={parts[1]} onFocus={event => event.currentTarget.select()} onChange={event => edit(1, event.target.value)} onPaste={paste} onKeyDown={event => { if (event.key === 'Backspace' && !parts[1]) fields.current[0]?.focus(); if (event.key === 'ArrowRight' && event.currentTarget.selectionStart === parts[1].length) fields.current[2]?.focus(); }} className={`${fieldClass} max-w-9`} />
        <span aria-hidden="true" className="px-1 text-gray-400">/</span>
        <input ref={element => { fields.current[2] = element; }} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="bday-year" aria-label="Année de naissance" aria-invalid={invalid} placeholder="AAAA" value={parts[2]} onFocus={event => event.currentTarget.select()} onChange={event => edit(2, event.target.value)} onPaste={paste} onKeyDown={event => { if (event.key === 'Backspace' && !parts[2]) fields.current[1]?.focus(); }} className={`${fieldClass} max-w-16`} />
      </div>
      {invalid && <p role="alert" className="mt-1 text-xs font-medium text-red-700">Saisissez une date de naissance valide et passée.</p>}
    </div>
  );
};
