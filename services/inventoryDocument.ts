import { HAVEN_LOGO_DATA_URL } from './havenLogo';
import type { InventoryReport, Booking, Listing, User } from '../types';
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const labels: Record<string, string> = { ROOM: 'Chambre', COMMONS: 'Espaces communs', KITCHEN: 'Cuisine', KEYS: 'Dépôt des clés', DAMAGE: 'Dégradation', private_clean: 'Chambre propre et rangée', private_empty: 'Affaires personnelles retirées', kitchen_clean: 'Cuisine propre', common_clean: 'Espaces communs propres', bathroom_clean: 'Sanitaires propres', keys_deposited: 'Clés déposées', no_new_damage: 'Aucune nouvelle dégradation', damage_reported: 'Dégradation signalée', clean: 'Propre', tidy: 'Rangé', conditionOk: 'Bon état' };
export interface InventoryDocumentContext {
  booking?: Booking;
  listing?: Listing;
  tenant?: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'phone'>;
}
// Presentation only: contextual information is not written back to the saved inspection.
export function inventoryDocumentHtml(report: InventoryReport, title: string, context: InventoryDocumentContext = {}): string {
  let data: any;
  try { data = JSON.parse(report.comments) || {}; } catch { data = {}; }
  const matchingBooking = context.booking?.id === report.bookingId ? context.booking : undefined;
  const stay = report.stay || (matchingBooking ? { listingTitle: matchingBooking.listingTitle || context.listing?.title || title, roomName: matchingBooking.roomName || '', startDate: matchingBooking.startDate, endDate: matchingBooking.endDate, tenantName: '', timeZone: matchingBooking.timeZone || 'Europe/Paris' } : undefined);
  const entry = report.type !== 'OUT';
  const documentType = entry ? 'État des lieux d’entrée' : 'État des lieux de sortie';
  const findings = Object.values(data.assessments || {}) as any[];
  const hasIssues = findings.some(value => ['clean', 'tidy', 'conditionOk'].some(key => value?.[key] === false)) || Boolean(data.incident?.description);
  const moment = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: stay?.timeZone || 'Europe/Paris' }).format(new Date(report.date));
  const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : 'Non renseigné';
  const booking = context.booking?.id === report.bookingId ? context.booking : undefined;
  const listing = booking && context.listing?.id === booking.listingId ? context.listing : undefined;
  const tenant = context.tenant?.id === report.tenantId ? context.tenant : undefined;
  const room = listing?.rooms?.find(item => item.id === booking?.roomId);
  const field = (label: string, value: unknown) => value !== undefined && value !== null && value !== '' ? `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>` : '';
  const tenantName = stay?.tenantName || [tenant?.firstName, tenant?.lastName].filter(Boolean).join(' ');
  const address = listing ? [listing.address, [listing.postalCode, listing.city].filter(Boolean).join(' '), listing.country].filter(Boolean).join(', ') : '';
  const details = `<section class="area"><h2>Informations du séjour</h2><div class="info-grid"><dl class="info-fields">${field('Adresse', address)}${field('Surface de la chambre', room?.size ? `${room.size} m²` : '')}</dl><dl class="info-fields">${field('Locataire', tenantName)}${field('E-mail', tenant?.email)}${field('Téléphone', tenant?.phone)}${field('Arrivée prévue', booking?.checkInTime ? `À partir de ${booking.checkInTime}` : '')}${field('Départ prévu', booking?.checkOutTime ? `Avant ${booking.checkOutTime}` : '')}</dl></div></section>`;
  const gallery = (photos: unknown) => {
    if (!Array.isArray(photos)) return '';
    const images = photos.filter(src => typeof src === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src));
    return images.length ? `<div class="gallery">${images.map((src, index) => `<figure><img src="${src}" alt="Photo ${index + 1} de l’état des lieux" /><figcaption>Photo ${index + 1}</figcaption></figure>`).join('')}</div>` : '';
  };
  const rows = (values: Record<string, unknown>) => `<dl class="checks">${Object.entries(values || {}).filter(([key]) => key in labels).map(([key, value]) => `<div><dt>${escape(labels[key])}</dt><dd class="${value === false ? 'issue' : value === true ? 'ok' : 'neutral'}">${value === true ? 'Oui' : value === false ? 'Non' : 'Non renseigné'}</dd></div>`).join('')}</dl>`;
  const assessments = Object.entries(data.assessments || {}).filter(([, value]) => value && typeof value === 'object').map(([area, value]: [string, any], index) => {
    const issue = ['clean', 'tidy', 'conditionOk'].some(key => value?.[key] === false);
    return `<section class="area"><div class="section-title"><h2><span class="number">0${index + 1}</span>${escape(labels[area] || area)}</h2><span class="badge ${issue ? 'warning' : 'success'}">${issue ? 'Non-conformité signalée' : 'Conforme'}</span></div>${rows(value)}${value.comment ? `<div class="observation"><h3>Observations du locataire</h3><p>${escape(value.comment)}</p></div>` : ''}${gallery(value.photos)}</section>`;
  }).join('');
  const photos = Object.entries(data.photos || {}).map(([area, values]) => `<section class="area"><h2>${escape(labels[area] || area)}</h2>${gallery(values)}</section>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><style>
  :root{--navy:#202b3d;--wine:#913c48;--ink:#344051;--muted:#7b7b79;--line:#e7e2dc;--paper:#fffefa;--cream:#f6f2ec}
  *{box-sizing:border-box}body{margin:0;background:#eae8e4;color:var(--ink);font:14px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
  .document{max-width:960px;margin:40px auto;background:var(--paper);box-shadow:0 18px 65px #202b3d12;overflow:hidden}
  .header{position:relative;padding:40px 54px 42px;background:var(--cream);border-top:5px solid var(--wine)}
  .masthead{display:flex;justify-content:space-between;align-items:center;gap:24px;padding-bottom:30px;border-bottom:1px solid #dcd5cd}
  .brand{display:inline-flex;max-width:55%}.brand img{display:block;width:178px;max-width:100%;height:auto;mix-blend-mode:multiply}


  h1{max-width:680px;font-family:Georgia,"Times New Roman",serif;font-size:44px;font-weight:400;line-height:1.14;letter-spacing:-1.2px;color:var(--navy);margin:30px 0 0}
  .listing{margin:17px 0 0;font-size:15px;color:#62666b}.content{padding:0 54px 40px}
  .summary{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:25px 0;border-bottom:1px solid var(--line)}.summary p{margin:0;color:var(--muted);font-size:11px}
  .badge{display:inline-flex;align-items:center;gap:7px;border-radius:4px;padding:5px 9px;font-size:10px;line-height:1.5;font-weight:600;white-space:normal}.badge:before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor;flex:none}
  .success,.ok{background:#edf3ee;color:#3c6651}.warning,.issue{background:#f8eee7;color:#9a583a}.neutral{background:#f0efed;color:#687079}
  .meta{display:grid;grid-template-columns:1fr 1fr;column-gap:28px;row-gap:17px;padding:23px 0 26px;border-bottom:1px solid var(--line)}.meta div{min-width:0}.meta small{display:block;font-size:9px;font-weight:600;letter-spacing:1.3px;text-transform:uppercase;color:var(--muted)}.meta strong{display:block;font-size:13px;font-weight:550;margin-top:5px;overflow-wrap:anywhere}.reference{font-family:monospace;font-size:10px!important;font-weight:400!important;color:#757a81}
  .area{padding:31px 0;margin:0;border-bottom:1px solid var(--line)}h2{font-family:Georgia,"Times New Roman",serif;font-size:25px;font-weight:400;line-height:1.3;color:var(--navy);margin:0 0 22px;letter-spacing:-.4px}.section-title{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:23px}.section-title h2{margin:0}.number{display:inline-block;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:10px;letter-spacing:1px;color:var(--wine);margin-right:13px;vertical-align:middle}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:36px}.info-fields{margin:0}.info-fields>div{padding:9px 0;break-inside:avoid}.info-fields dt{font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--muted)}.info-fields dd{margin:4px 0 0;overflow-wrap:anywhere;font-size:13px;font-weight:500}
  .checks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0}.checks>div{background:#f7f6f2;border:1px solid #eeebe5;padding:16px 17px;break-inside:avoid;min-width:0}.checks dt{font-size:12px;color:#64696f}.checks dd{display:inline-block;margin:10px 0 0;border-radius:3px;padding:2px 9px;font-size:11px;font-weight:600}
  .observation{margin:22px 0 0;padding:17px 21px;background:#f7f2ee;border-left:2px solid var(--wine)}h3{font-size:9px;text-transform:uppercase;letter-spacing:1.3px;margin:0 0 7px;color:var(--wine);font-weight:600}p{white-space:pre-wrap;overflow-wrap:anywhere}.observation p{margin:0;font-size:13px;line-height:1.8}
  .gallery{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:25px}figure{margin:0;min-width:0;break-inside:avoid}figure img{display:block;width:100%;height:240px;object-fit:contain;background:#f3f1ed;border:1px solid var(--line);padding:6px}figcaption{font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:var(--muted);padding:9px 0 0}
  .validation{position:relative;margin-top:30px;padding:23px 26px 23px 47px;background:var(--navy);color:#f5f1ea}.validation:before{content:"✓";position:absolute;left:23px;top:24px;color:#c7d8ca;font-size:15px}.validation strong{display:block;font-size:13px;font-weight:550;letter-spacing:.1px}.validation p{font-size:11px;line-height:1.8;color:#bfc5cc;margin:6px 0 0}
  .footer{display:flex;justify-content:space-between;gap:25px;padding:22px 54px;border-top:1px solid var(--line);font-size:9px;line-height:1.7;color:var(--muted)}.footer-brand{font-weight:650;letter-spacing:2px;color:var(--wine)}.footer-note{text-align:right}
  @media(max-width:600px){.document{margin:0;box-shadow:none}.header{padding:26px 24px 30px}.masthead{padding-bottom:23px}.brand img{width:145px}h1{font-size:34px}.listing{font-size:13px}.content{padding:0 24px 28px}.summary{align-items:flex-start;flex-direction:column;gap:9px;padding:20px 0}.meta{gap:17px}.meta strong{font-size:12px}.area{padding:25px 0}h2{font-size:23px}.section-title{align-items:flex-start;gap:12px;flex-wrap:wrap}.info-grid{grid-template-columns:1fr;gap:0}.checks{gap:6px}.checks>div{padding:12px 9px}.checks dt{font-size:10px}.gallery{gap:12px}figure img{height:180px}.validation{padding:20px 20px 20px 40px}.validation:before{left:18px;top:20px}.footer{padding:20px 24px;gap:18px}.footer-note{max-width:75%}}
  @page{size:A4;margin:12mm}
  @media print{body{background:white;font-size:11px;print-color-adjust:exact;-webkit-print-color-adjust:exact}.document{max-width:none;margin:0;box-shadow:none}.header{padding:22px 26px 28px}.masthead{padding-bottom:20px}.brand img{width:150px}h1{font-size:34px}.content{padding:0 26px 22px}.area{padding:24px 0;break-inside:auto}.section-title,.meta,.summary,.validation,.observation{break-inside:avoid}.info-grid{grid-template-columns:1fr 1fr;gap:28px}.checks{grid-template-columns:repeat(3,minmax(0,1fr))}.gallery{grid-template-columns:1fr 1fr}figure img{height:190px}.footer{padding:17px 26px}.validation{background:#f0f3f1;color:var(--navy);border:1px solid #dce4de}.validation p{color:#52645a}.validation:before{color:#3c6651}}
  </style></head><body><article class="document"><header class="header"><div class="masthead"><div class="brand"><img src="${HAVEN_LOGO_DATA_URL}" alt="Haven" width="178"></div></div><h1>${documentType}</h1><p class="listing">${escape(stay?.listingTitle || listing?.title || title)}${(stay?.roomName || booking?.roomName || room?.name) ? ` · ${escape(stay?.roomName || booking?.roomName || room?.name)}` : ''}</p></header><main class="content"><div class="summary"><span class="badge ${hasIssues ? 'warning' : 'success'}">${hasIssues ? 'Non-conformités signalées' : 'Contrôle enregistré'}</span></div><div class="meta">${stay ? `<div><small>Dates du séjour</small><strong>${date(stay.startDate)} – ${date(stay.endDate)}</strong></div>` : ''}<div><small>Réservation</small><strong class="reference">${escape(report.bookingId)}</strong></div></div>${details}${assessments}${data.checklist ? `<section class="area"><h2>Contrôles de départ</h2>${rows(data.checklist)}</section>` : ''}${photos}${data.incident?.description ? `<section class="area"><h2>Dégradation signalée</h2><div class="observation"><p>${escape(data.incident.description)}</p></div></section>` : ''}${data.earlyDeparture?.reason ? `<section class="area"><h2>Départ anticipé</h2><p>${escape(data.earlyDeparture.reason)}</p></section>` : ''}${!data.assessments && !data.checklist ? `<section class="area"><p>${escape(report.comments)}</p></section>` : ''}<div class="validation"><strong>Confirmé par le locataire</strong><p>Le ${escape(moment)}</p></div></main><footer class="footer"><span class="footer-brand">HAVEN</span><span class="footer-note">Document à conserver.</span></footer></article></body></html>`;
}
