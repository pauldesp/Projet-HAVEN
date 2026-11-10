import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Booking, BookingSeries, Incident } from '../types';
import type { OwnerMailData, OwnerMailJob } from './ownerMail';
import { createReservationConfirmation } from './reservationFulfillment';
import { RESEND_TEMPLATE_IDS, authResendTemplate, ownerResendTemplate, teamResendTemplate, mailDashboardLink, reservationResendTemplate, resendTemplatesEnabled, selectMailContent, tenantResendTemplate } from './resendTemplates';
import { nextAuthMailLimit, sendAuthActionMail } from './authMail';
import type { TenantMailJob } from './tenantMail';

const at = '2026-11-12T14:24:00.000Z';
const origin = 'https://haven.example';
const authDomain = 'haven-example.firebaseapp.com';
const booking = { id: 'demo', tenantId: 'tenant', ownerId: 'owner', listingId: 'listing', listingTitle: '<Maison>', roomName: 'Horizon', startDate: '2026-11-12', endDate: '2026-11-19', paidAt: at, totalPrice: 176, basePrice: 140, cleaningFee: 20, platformFee: 16, paymentProvider: 'SIMULATION', paymentIsTest: true, completedAt: '2026-11-19T10:00:00Z', cancellation: { cancelledAt: at, cancelledBy: 'TENANT', reason: '<script>bad</script>', refundAmount: 176, refundStatus: 'SIMULATED' } } as Booking;
const receipt = createReservationConfirmation(booking, { address: 'Adresse fictive' }, { firstName: '<Camille>', email: 'demo@example.com' });
const profile = { firstName: '<Camille>', rejectionReason: '<script>correction</script>' };
const manifest = JSON.parse(readFileSync(new URL('../docs/resend-templates/manifest.json', import.meta.url), 'utf8')) as { kind: keyof typeof RESEND_TEMPLATE_IDS; variables: {key: string}[] }[];

test('all twenty-two providers receive exactly the variables defined in the editable templates', () => {
  assert.equal(manifest.length, 22);
  const later = { ...booking, id: 'b2', seriesId: 's1', seriesIndex: 1, seriesCount: 2, status: 'PENDING', paymentStatus: 'PENDING', installmentDueDate: '2026-12-10', seriesActivatedAt: at, seriesScheduled: true, installmentAttempts: 1, installmentLastError: 'Carte refusée', cancellation: undefined, unpaidCancelledAt: at } as Booking;
  const series = { id: 's1', status: 'ACTIVE', paymentProvider: 'STRIPE', cardBrand: 'visa', cardLast4: '4242', bookingIds: ['demo', 'b2'] } as BookingSeries;
  const ownerData: OwnerMailData = { owner: { firstName: 'Paul', email: 'owner@example.test' }, tenant: { firstName: 'Camille', lastName: 'Dupont' }, booking: { ...booking, seriesId: 's1', seriesIndex: 0, paymentStatus: 'PAID', status: 'CONFIRMED' } as Booking, stays: [{ ...booking, seriesIndex: 0, paymentStatus: 'PAID' } as Booking, later],
    incident: { id: 'i1', title: 'Chauffage', description: 'Panne', priority: 'MEDIUM', createdAt: at, ownerId: 'owner', bookingId: 'demo', listingId: 'listing', reporterId: 'tenant', status: 'NEW' } as Incident,
    payout: { id: 'p1', ownerId: 'owner', amountCents: 32000, currency: 'EUR', provider: 'STRIPE', isTest: true, status: 'PAID', createdAt: at, paidAt: at, providerPayoutId: 'po_1' } };
  for (const model of manifest) {
    let content;
    if (model.kind === 'HAVEN_ALERT') content = teamResendTemplate({ kind: 'HAVEN_ALERT', task: 'MAIL_DELIVERY', message: 'Resend indisponible', failures: 3, occurredAt: at, status: 'PENDING', attempts: 0, nextAttemptAt: at }, {}, origin);
    else if (model.kind === 'HAVEN_REPORT') content = teamResendTemplate({ kind: 'HAVEN_REPORT', reportId: 'r1', occurredAt: at, status: 'PENDING', attempts: 0, nextAttemptAt: at },
      { report: { id: 'r1', reporterId: 'tenant', targetId: 'listing', targetType: 'LISTING', reason: 'FRAUD', description: 'Photos volées', status: 'NEW', timestamp: at }, reporter: { firstName: 'Camille', lastName: 'Dupont' }, listingTitle: 'Coloc Martin' }, origin);
    else if (model.kind.startsWith('OWNER_')) content = ownerResendTemplate({ kind: model.kind, userId: 'owner', occurredAt: at, seriesId: 's1' } as OwnerMailJob, ownerData, origin);
    else if (['SERIES_CONFIRMED', 'INSTALLMENT_UPCOMING', 'INSTALLMENT_FAILED', 'INSTALLMENT_UNPAID'].includes(model.kind)) content = tenantResendTemplate({ kind: model.kind, userId: 'tenant', occurredAt: at } as TenantMailJob, profile, later, undefined, origin, { series, stays: [booking, later] })!;
    else if (['EMAIL_VERIFICATION', 'PASSWORD_RESET'].includes(model.kind)) content = authResendTemplate(model.kind as 'EMAIL_VERIFICATION' | 'PASSWORD_RESET', '<Camille>', `https://${authDomain}/__/auth/action?mode=${model.kind === 'EMAIL_VERIFICATION' ? 'verifyEmail' : 'resetPassword'}&oobCode=FICTIF`, authDomain);
    else if (['ACCOUNT_APPROVED', 'ACCOUNT_CORRECTION', 'CANCELLED', 'REVIEW_INVITE'].includes(model.kind)) content = tenantResendTemplate({kind:model.kind, userId:'tenant', occurredAt:at} as TenantMailJob, profile, booking, undefined, origin)!;
    else content = reservationResendTemplate(model.kind as 'CONFIRMATION', receipt, { appOrigin: origin, occurredAt: at, instructions: 'Code privé 1234' });
    assert.equal(content.template.id, RESEND_TEMPLATE_IDS[model.kind]);
    assert.deepEqual(Object.keys(content.template.variables).sort(), model.variables.map(v => v.key).sort(), model.kind);
    assert.doesNotMatch(JSON.stringify(content), /<script>|<Camille>|<Maison>/);
    // Every value of the new models is filled, except the optional test mention and retry notice.
    if (model.kind.startsWith('HAVEN_') || model.kind.startsWith('OWNER_') || model.kind.startsWith('INSTALLMENT_') || model.kind === 'SERIES_CONFIRMED') {
      const empty = Object.entries(content.template.variables).filter(([key, value]) => !value && !['MENTION_TEST', 'INFORMATION_RELANCE'].includes(key)).map(([key]) => key);
      assert.deepEqual(empty, [], model.kind);
    }
  }
});
test('private access instructions appear only in the arrival template and absent instructions remain truthful', () => {
  for (const kind of ['CONFIRMATION','CHECKIN','CHECKOUT','DEPARTURE_REMINDER'] as const) assert.doesNotMatch(JSON.stringify(reservationResendTemplate(kind, receipt, { appOrigin:origin, occurredAt:at, instructions:'SECRET_1234' })), /SECRET_1234/);
  assert.match(reservationResendTemplate('ARRIVAL',receipt,{appOrigin:origin}).template.variables.CONSIGNES_ACCES,/pas encore renseignées/);
});
test('test approval, refunds and review deadline use recorded facts', () => {
  const job = { kind:'ACCOUNT_APPROVED', userId:'tenant', exceptional:true } as TenantMailJob;
  const approval = tenantResendTemplate(job,profile,undefined,undefined,origin).template.variables;
  assert.match(approval.MESSAGE_VALIDATION,/exceptionnelle de test/);assert.match(approval.MENTION_TEST,/TEST/);
  const cancelled = tenantResendTemplate({...job,kind:'CANCELLED'},profile,booking,undefined,origin).template.variables;
  assert.match(cancelled.INFORMATION_REMBOURSEMENT,/simulé/);assert.match(cancelled.MOTIF_ANNULATION,/&lt;script&gt;/);
  const review = tenantResendTemplate({...job,kind:'REVIEW_INVITE'},profile,booking,undefined,origin).template.variables;
  assert.match(review.DATE_LIMITE_AVIS,/26 novembre 2026/);
  const overseas = tenantResendTemplate({...job,kind:'REVIEW_INVITE'},profile,{...booking,timeZone:'America/Guadeloupe'},undefined,origin).template.variables;
  assert.match(overseas.DATE_LIMITE_AVIS,/06:00/, 'the review deadline uses the property timezone');
});
test('Firebase links cannot be replaced by caller-controlled domains, modes or missing tokens', () => {
  for(const link of ['https://attacker.example/?mode=resetPassword&oobCode=x',`http://${authDomain}/?mode=resetPassword&oobCode=x`,`https://${authDomain}/?mode=verifyEmail&oobCode=x`,`https://${authDomain}/?mode=resetPassword`]) assert.throws(()=>authResendTemplate('PASSWORD_RESET','Camille',link,authDomain));
  const vars=authResendTemplate('PASSWORD_RESET','Camille',`https://${authDomain}/__/auth/action?mode=resetPassword&oobCode=FICTIF`,authDomain).template.variables;
  assert.match(vars.LIEN_ACTION,/lang=fr/);assert.match(vars.LIEN_ACTION,/&amp;/);
  assert.throws(()=>mailDashboardLink('javascript:alert(1)'));
});
test('template mode is explicit and never mixes template with legacy html/text', () => {
  assert.equal(resendTemplatesEnabled({}),false);
  assert.equal(resendTemplatesEnabled({RESEND_TEMPLATES_ENABLED:'true'}),true);
  const legacy={subject:'subject',text:'text',html:'<p>legacy</p>'};
  assert.equal(selectMailContent(legacy,undefined),legacy);
  const selected=reservationResendTemplate('CONFIRMATION',receipt,{appOrigin:origin});
  assert.equal(selectMailContent(legacy,selected),selected);
  assert(!('html' in selectMailContent(legacy,selected)));
});
test('authentication email throttling persists across callers and caps five requests per fifteen minutes', () => {
  let now=Date.parse(at), limit=nextAuthMailLimit(undefined,now)!;
  assert.equal(nextAuthMailLimit(limit,now+59999),undefined);
  for(let i=1;i<5;i++){now+=60000;limit=nextAuthMailLimit(limit,now)!;assert.equal(limit.count,i+1);}
  assert.equal(nextAuthMailLimit(limit,now+60000),undefined);
  assert.equal(nextAuthMailLimit(limit,Date.parse(at)+15*60000)!.count,1);
});
test('authentication mail claims the limit before generation and never sends an invalid Firebase link', async () => {
  let generated=0,sent=0;
  const actions={claim:async()=>false,generate:async()=>{generated++;return `https://${authDomain}/?mode=verifyEmail&oobCode=FICTIF`;},send:async()=>{sent++;}};
  assert.equal(await sendAuthActionMail('EMAIL_VERIFICATION','Camille',authDomain,actions),false);assert.equal(generated,0);
  assert.equal(await sendAuthActionMail('EMAIL_VERIFICATION','Camille',authDomain,{...actions,claim:async()=>true}),true);assert.equal(sent,1);
  await assert.rejects(sendAuthActionMail('EMAIL_VERIFICATION','Camille',authDomain,{...actions,claim:async()=>true,generate:async()=> 'https://attacker.example/'}));assert.equal(sent,1);
});

test('changing an email uses only the verified Firebase change action with the existing verification template', () => {
  const authDomain = 'example.firebaseapp.com';
  const content = authResendTemplate('EMAIL_VERIFICATION', 'Camille', `https://${authDomain}/__/auth/action?mode=verifyAndChangeEmail&oobCode=FICTIF`, authDomain);
  assert.equal(content.template.id, RESEND_TEMPLATE_IDS.EMAIL_VERIFICATION);
  assert.throws(() => authResendTemplate('PASSWORD_RESET', 'Camille', `https://${authDomain}/__/auth/action?mode=verifyAndChangeEmail&oobCode=FICTIF`, authDomain));
  assert.throws(() => authResendTemplate('EMAIL_VERIFICATION', 'Camille', `https://attacker.test/__/auth/action?mode=verifyAndChangeEmail&oobCode=FICTIF`, authDomain));
});
