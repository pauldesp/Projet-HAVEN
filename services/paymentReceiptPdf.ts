import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import type { ReservationConfirmation } from './reservationFulfillment';
import { countNights } from './stay';

const logoPath = fileURLToPath(new URL('../public/logo.png', import.meta.url));
const C = { navy: '#1E293B', wine: '#9D1645', stone: '#64748B', cream: '#F8F6F3', line: '#E6E8EB', white: '#FFFFFF' };

/** A payment receipt, never presented as a tax invoice or a real payment in test mode. */
export async function paymentReceiptPdf(receipt: ReservationConfirmation): Promise<Buffer> {
  const title = receipt.isTest ? 'Justificatif de simulation' : 'Justificatif de paiement';
  const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true, info: { Title: `${title} - Haven`, Author: 'Haven', Subject: `Réservation ${receipt.bookingId}` } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => { doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  const width = doc.page.width - 84;
  const money = (amount: number) => `${amount.toFixed(2).replace('.', ',')} €`;
  const date = (value: string) => value.slice(0, 10).split('-').reverse().join('/');
  const nights = countNights(receipt.startDate, receipt.endDate);
  let y = 0;
  const text = (value: string, x: number, top: number, w: number, size = 10, color = C.navy, bold = false, align: 'left' | 'right' = 'left') => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color).text(value, x, top, { width: w, lineGap: 3, align });
    return doc.y;
  };
  const height = (value: string, w: number, size = 10, bold = false) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).heightOfString(value, { width: w, lineGap: 3 });
  const line = (top: number) => doc.moveTo(42, top).lineTo(42 + width, top).lineWidth(.7).strokeColor(C.line).stroke();
  const heading = (value: string) => { text(value, 42, y, width, 9, C.wine, true); y += 23; };
  const header = (continued = false) => {
    doc.rect(0, 0, doc.page.width, 92).fill(C.cream);
    doc.image(logoPath, 42, 24, { width: 120 });
    text('RÉSERVATION HAVEN', 300, 30, doc.page.width - 342, 8, C.stone, true, 'right');
    text(`${continued ? 'Suite du justificatif' : 'Émis le'} ${continued ? '' : date(receipt.paidAt)}`.trim(), 300, 47, doc.page.width - 342, 9, C.stone, false, 'right');
    y = 112;
  };
  const ensure = (needed: number) => {
    if (y + needed > doc.page.height - 100) { doc.addPage(); header(true); }
  };
  header();
  text(title, 42, y, width, 25, C.navy, true); y += 35;
  text(receipt.isTest ? 'Simulation enregistrée pour votre réservation' : 'Paiement enregistré pour votre réservation', 42, y, width, 10, C.stone); y += 24;

  doc.roundedRect(42, y, width, 73, 12).fill(C.navy);
  text(receipt.isTest ? 'MONTANT SIMULÉ' : 'TOTAL PAYÉ', 62, y + 13, width - 40, 8, '#C9D2DF', true);
  text(money(receipt.amountCents / 100), 62, y + 32, width - 40, 29, C.white, true);
  text(receipt.isTest ? 'SIMULATION · AUCUN DÉBIT' : receipt.provider === 'STRIPE' ? 'PAIEMENT VIA STRIPE' : `PAIEMENT VIA ${receipt.provider}`, 310, y + 45, width - 288, 8, '#C9D2DF', true, 'right');
  y += 85;
  if (receipt.isTest) {
    const warning = 'MODE TEST - Aucun paiement réel ni débit bancaire. Ce document ne prouve pas un encaissement.';
    const h = height(warning, width - 28, 9) + 22;
    doc.roundedRect(42, y, width, h, 8).fill('#FBF0F3');
    text(warning, 56, y + 11, width - 28, 9, C.wine); y += h + 16;
  } else y += 10;

  const gap = 18;
  const col = (width - gap) / 2;
  const stayAddress = receipt.address || 'Adresse non renseignée';
  const left = height(receipt.tenantName, col - 30, 12, true) + height(receipt.email || 'E-mail non renseigné', col - 30, 10) + 52;
  const right = height(receipt.listingTitle, col - 30, 12, true) + height(receipt.roomName || 'Chambre réservée', col - 30) + height(stayAddress, col - 30, 9) + 58;
  const cardsHeight = Math.max(left, right);
  ensure(cardsHeight + 16);
  for (const x of [42, 42 + col + gap]) doc.roundedRect(x, y, col, cardsHeight, 10).lineWidth(.7).strokeColor(C.line).stroke();
  text('LOCATAIRE', 57, y + 15, col - 30, 8, C.stone, true);
  let localY = text(receipt.tenantName, 57, y + 36, col - 30, 12, C.navy, true) + 7;
  text(receipt.email || 'E-mail non renseigné', 57, localY, col - 30, 10, C.stone);
  const rx = 57 + col + gap;
  text('VOTRE LOGEMENT', rx, y + 15, col - 30, 8, C.stone, true);
  localY = text(receipt.listingTitle, rx, y + 36, col - 30, 12, C.navy, true) + 6;
  localY = text(receipt.roomName || 'Chambre réservée', rx, localY, col - 30) + 7;
  text(stayAddress, rx, localY, col - 30, 9, C.stone);
  y += cardsHeight + 14;

  ensure(72);
  doc.roundedRect(42, y, width, 58, 9).fill(C.cream);
  text('ARRIVÉE', 57, y + 12, col - 30, 8, C.stone, true);
  text(`${date(receipt.startDate)} · À partir de ${receipt.checkInTime}`, 57, y + 31, col - 30, 10, C.navy, true);
  text('DÉPART', rx, y + 12, col - 30, 8, C.stone, true);
  text(`${date(receipt.endDate)} · Avant ${receipt.checkOutTime}`, rx, y + 31, col - 30, 10, C.navy, true);
  y += 77;

  ensure(147);
  heading('DÉTAIL DU PRIX');
  for (const [label, amount] of [
    [nights ? `Séjour · ${nights} ${nights === 1 ? 'nuit' : 'nuits'}` : 'Séjour', receipt.basePrice],
    ['Forfait ménage (par location)', receipt.cleaningFee],
    ['Frais de service Haven', receipt.platformFee],
  ] as const) {
    text(label, 42, y, width - 130, 10, C.stone);
    text(money(amount), 42 + width - 120, y, 120, 10, C.navy, false, 'right'); y += 23;
  }
  line(y); y += 13;
  text(receipt.isTest ? 'Total simulé · EUR' : 'Total payé · EUR', 42, y, width - 140, 11, C.navy, true);
  text(money(receipt.amountCents / 100), 42 + width - 130, y, 130, 13, C.navy, true, 'right'); y += 30;

  const refs = [
    ['Justificatif', receipt.id], ['Réservation', receipt.bookingId],
    ['Paiement', receipt.paymentReference || 'Non renseigné'],
    [receipt.isTest ? 'Date de simulation' : 'Date du paiement', date(receipt.paidAt)],
  ];
  const refsHeight = refs.reduce((sum, [, value]) => sum + Math.max(13, height(value, width - 158, 8)) + 6, 0) + 29;
  ensure(refsHeight);
  heading('RÉFÉRENCES');
  for (const [label, value] of refs) {
    text(label, 42, y, 145, 8, C.stone);
    const end = text(value, 200, y, width - 158, 8);
    y = Math.max(y + 13, end) + 6;
  }

  const pages = doc.bufferedPageRange();
  for (let index = 0; index < pages.count; index++) {
    doc.switchToPage(index);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const fy = doc.page.height - 73;
    line(fy);
    text('Ce justificatif ne constitue pas une facture fiscale. Les éventuels remboursements sont à consulter dans votre réservation.', 42, fy + 11, width - 60, 8, C.stone);
    text(`${index + 1} / ${pages.count}`, 42 + width - 50, fy + 11, 50, 8, C.stone, false, 'right');
    text('HAVEN  /  DOCUMENT DE RÉSERVATION', 42, doc.page.height - 31, width, 7, C.wine, true);
    doc.page.margins.bottom = bottomMargin;
  }
  doc.end();
  return result;
}
