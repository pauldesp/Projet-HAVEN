import { useState } from 'react';
import { BirthDateInput } from './BirthDateInput';
import { ageOn, isValidPastBirthDate } from '../services/profileVerification';
import { ADULT_AGE, GUARDIAN_DECLARATION_TEXT, GUARDIAN_DECLARATION_VERSION, MINIMUM_OCCUPANT_AGE } from '../services/occupant';
import { prepareVerificationDocument } from '../services/verificationDocument';

export type OccupantDraft = {
  forSomeoneElse: boolean;
  firstName: string; lastName: string; birthDate: string; email: string; phone: string;
  guardianDeclared: boolean;
  parentalAuthorization?: string;
  filename?: string;
};

export const emptyOccupantDraft = (): OccupantDraft => ({ forSomeoneElse: false, firstName: '', lastName: '', birthDate: '', email: '', phone: '', guardianDeclared: false });

/** Occupant age on the (first) arrival, or null while the birth date is incomplete. */
export const occupantAge = (draft: OccupantDraft, arrival: string) => isValidPastBirthDate(draft.birthDate) && arrival ? ageOn(draft.birthDate, arrival) : null;

/** What is still missing before booking for someone else (null when complete). */
export function occupantDraftProblem(draft: OccupantDraft, arrival: string): string | null {
  if (!draft.forSomeoneElse) return null;
  if (!draft.firstName.trim() || !draft.lastName.trim()) return 'Indiquez le prénom et le nom de l’occupant.';
  const age = occupantAge(draft, arrival);
  if (age === null) return 'Indiquez la date de naissance de l’occupant.';
  if (age < MINIMUM_OCCUPANT_AGE) return `L’occupant doit avoir au moins ${MINIMUM_OCCUPANT_AGE} ans le jour de l’arrivée.`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) return 'Indiquez l’adresse e-mail de l’occupant.';
  if (draft.phone.replace(/\D/g, '').length < 8) return 'Indiquez le téléphone de l’occupant.';
  if (age < ADULT_AGE && !draft.guardianDeclared) return 'L’occupant est mineur : déclarez être son représentant légal.';
  if (age < ADULT_AGE && !draft.parentalAuthorization) return 'L’occupant est mineur : joignez l’autorisation parentale.';
  return null;
}

/** Fields sent with the booking when it is made for someone else. */
export const occupantPayload = (draft: OccupantDraft, arrival: string) => {
  if (!draft.forSomeoneElse) return {};
  const minor = (occupantAge(draft, arrival) ?? ADULT_AGE) < ADULT_AGE;
  return {
    forSomeoneElse: true,
    occupant: { firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), birthDate: draft.birthDate, email: draft.email.trim(), phone: draft.phone.trim() },
    ...(minor ? { guardianDeclarationVersion: draft.guardianDeclared ? GUARDIAN_DECLARATION_VERSION : undefined, parentalAuthorization: draft.parentalAuthorization } : {}),
  };
};

/**
 * "Who stays?": by default the account that books. Booking for someone else asks for the occupant's identity
 * (visible to the owner before the stay); for a minor of 16 or 17, the legal representative's declaration and
 * a parental authorization.
 */
export function OccupantForm({ value, onChange, arrival }: { value: OccupantDraft; onChange: (next: OccupantDraft) => void; arrival: string }) {
  const [fileError, setFileError] = useState('');
  const [preparing, setPreparing] = useState(false);
  const set = (patch: Partial<OccupantDraft>) => onChange({ ...value, ...patch });
  const age = occupantAge(value, arrival);
  const minor = age !== null && age >= MINIMUM_OCCUPANT_AGE && age < ADULT_AGE;
  const field = 'mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 text-base text-haven-ink focus:border-haven-navy focus:outline-none';

  return <fieldset className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
    <legend className="px-1 font-semibold text-haven-ink">Qui séjourne ?</legend>
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Qui séjourne ?">
      {([[false, 'Moi'], [true, 'Quelqu’un d’autre']] as const).map(([forOther, label]) => <button key={label} type="button" role="radio" aria-checked={value.forSomeoneElse === forOther}
        onClick={() => set({ forSomeoneElse: forOther })}
        className={`min-h-11 rounded-full border px-4 font-semibold ${value.forSomeoneElse === forOther ? 'border-haven-navy bg-haven-navy text-white' : 'border-gray-300 text-haven-ink hover:bg-gray-100'}`}>{label}</button>)}
    </div>

    {value.forSomeoneElse && <div className="mt-4 space-y-3">
      <p className="leading-relaxed text-gray-600">Vous payez et restez responsable de la réservation. L’occupant reçoit par e-mail un lien vers son espace séjour : consignes d’arrivée, états des lieux, messages avec le propriétaire. Son identité est communiquée au propriétaire.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">Prénom<input value={value.firstName} onChange={event => set({ firstName: event.target.value })} autoComplete="off" maxLength={100} className={field} /></label>
        <label className="block">Nom<input value={value.lastName} onChange={event => set({ lastName: event.target.value })} autoComplete="off" maxLength={100} className={field} /></label>
      </div>
      <div className="block">Date de naissance<BirthDateInput value={value.birthDate} onChange={birthDate => set({ birthDate })} /></div>
      {age !== null && age < MINIMUM_OCCUPANT_AGE && <p role="alert" className="text-red-600">L’occupant doit avoir au moins {MINIMUM_OCCUPANT_AGE} ans le jour de l’arrivée.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">E-mail<input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={value.email} onChange={event => set({ email: event.target.value })} maxLength={200} className={field} /></label>
        <label className="block">Téléphone<input type="tel" inputMode="tel" value={value.phone} onChange={event => set({ phone: event.target.value })} placeholder="+33 6 12 34 56 78" maxLength={30} className={field} /></label>
      </div>

      {minor && <div className="space-y-3 rounded-xl bg-haven-sand p-4">
        <p className="font-semibold text-haven-ink">L’occupant aura {age} ans à l’arrivée : il est mineur.</p>
        <label className="flex items-start gap-3"><input type="checkbox" checked={value.guardianDeclared} onChange={event => set({ guardianDeclared: event.target.checked })} className="mt-1" />{GUARDIAN_DECLARATION_TEXT}</label>
        <div>
          <p>Autorisation parentale signée (PDF, JPG ou PNG)</p>
          <input type="file" accept="image/jpeg,image/png,application/pdf" disabled={preparing} aria-label="Joindre l’autorisation parentale" className="mt-2 block w-full text-sm"
            onChange={event => {
              const file = event.target.files?.[0];
              if (!file) return;
              setFileError(''); setPreparing(true);
              void prepareVerificationDocument(file)
                .then(dataUrl => set({ parentalAuthorization: dataUrl, filename: file.name }))
                .catch(error => { setFileError(error instanceof Error ? error.message : 'Document illisible.'); set({ parentalAuthorization: undefined, filename: undefined }); })
                .finally(() => setPreparing(false));
            }} />
          {preparing && <p className="mt-1 text-gray-500">Préparation du document…</p>}
          {value.filename && !preparing && <p className="mt-1 text-gray-600">Document joint : {value.filename}</p>}
          {fileError && <p role="alert" className="mt-1 text-red-600">{fileError}</p>}
        </div>
      </div>}
    </div>}
  </fieldset>;
}
