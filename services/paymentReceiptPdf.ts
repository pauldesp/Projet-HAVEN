import PDFDocument from 'pdfkit';
import type { ReservationConfirmation } from './reservationFulfillment';

export async function paymentReceiptPdf(receipt: ReservationConfirmation): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 52, info: { Title: 'Justificatif de paiement Haven', Author: 'Haven' } });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => { doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  const money = (amount: number) => `${amount.toFixed(2).replace('.', ',')} EUR`;
  const date = (value: string) => value.slice(0, 10).split('-').reverse().join('/');
  doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(28).text('HAVEN');
  doc.moveDown().fontSize(20).text(receipt.isTest ? 'Justificatif de simulation' : 'Justificatif de paiement');
  if (receipt.isTest) doc.moveDown().fontSize(12).fillColor('#a33f3f').text('TEST - Aucun paiement réel ni débit bancaire. Ce document ne prouve pas un encaissement.');
  doc.fillColor('#1e293b').moveDown().font('Helvetica').fontSize(10).text(`Référence : ${receipt.id}\nÉmis le ${date(receipt.paidAt)}\nRéservation : ${receipt.bookingId}`);
  doc.moveDown(2).font('Helvetica-Bold').fontSize(13).text(receipt.tenantName);
  doc.font('Helvetica').fontSize(11).text(receipt.email);
  doc.moveDown().font('Helvetica-Bold').text(receipt.listingTitle);
  doc.font('Helvetica').text(receipt.roomName).text(receipt.address || 'Adresse à préciser par le propriétaire');
  doc.moveDown().text(`Séjour du ${date(receipt.startDate)} au ${date(receipt.endDate)}`);
  doc.text(`Arrivée à partir de ${receipt.checkInTime} - départ avant ${receipt.checkOutTime}`);
  doc.moveDown(2);
  for (const [label, amount] of [['Hébergement', receipt.basePrice], ['Ménage', receipt.cleaningFee], ['Frais de service', receipt.platformFee]] as const) doc.text(`${label} : ${money(amount)}`).moveDown(.5);
  doc.font('Helvetica-Bold').fontSize(16).text(`${receipt.isTest ? 'Montant simulé' : 'Total payé'} : ${money(receipt.amountCents / 100)}`);
  doc.moveDown().font('Helvetica').fontSize(9).text(`Mode : ${receipt.provider}${receipt.isTest ? ' (test)' : ''}\nRéférence du paiement : ${receipt.paymentReference}`);
  doc.moveDown(2).text('Les informations d’entrée sont envoyées 72 heures avant l’arrivée, ou dès confirmation pour une réservation de dernière minute.');
  doc.moveDown().fillColor('#64748b').text('Ce justificatif concerne le paiement de la réservation. Il ne constitue pas une facture fiscale. En cas d’annulation, consultez le statut et les éventuels remboursements dans votre réservation.');
  doc.end();
  return result;
}
