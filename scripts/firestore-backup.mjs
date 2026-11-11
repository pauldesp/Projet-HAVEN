// Firestore managed backups for Haven.
//   node scripts/firestore-backup.mjs status            schedules and existing backups (read only)
//   node scripts/firestore-backup.mjs enable            daily backup kept 14 days + weekly backup kept 14 weeks
//   node scripts/firestore-backup.mjs restore-test      restores the latest backup into a separate database "haven-restore-test"
//   node scripts/firestore-backup.mjs drop-restore-test deletes that test database
// Uses the Google credentials of this machine (gcloud auth application-default login). Never touches the live database.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { applicationDefault } = require('firebase-admin/app');
const config = JSON.parse(readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf8'));
const project = `projects/${config.projectId}`;
const database = `${project}/databases/${config.firestoreDatabaseId}`;
const RESTORE_TEST = 'haven-restore-test';
const API = 'https://firestore.googleapis.com/v1';

const { access_token: token } = await applicationDefault().getAccessToken();
async function call(path, method = 'GET', body) {
  const response = await fetch(`${API}/${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-goog-user-project': config.projectId }, body: body && JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(data.error || data).slice(0, 500)}`);
  return data;
}
const DAY = 86400;
const schedules = async () => (await call(`${database}/backupSchedules`)).backupSchedules || [];
// Backups are stored per location; "-" lists every location of the project.
const backups = async () => ((await call(`${project}/locations/-/backups`)).backups || [])
  .filter(item => item.database === database).sort((a, b) => (b.snapshotTime || '').localeCompare(a.snapshotTime || ''));

const command = process.argv[2] || 'status';
if (command === 'status') {
  const list = await schedules();
  console.log(list.length ? list.map(item => `Programmée : ${item.dailyRecurrence ? 'quotidienne' : 'hebdomadaire'}, conservée ${Math.round(parseInt(item.retention) / DAY)} jours`).join('\n') : 'Aucune sauvegarde programmée.');
  const done = await backups();
  console.log(done.length ? done.slice(0, 10).map(item => `Sauvegarde du ${item.snapshotTime} · ${item.state} · expire le ${item.expireTime}`).join('\n') : 'Aucune sauvegarde existante.');
} else if (command === 'enable') {
  const list = await schedules();
  if (!list.some(item => item.dailyRecurrence)) await call(`${database}/backupSchedules`, 'POST', { retention: `${14 * DAY}s`, dailyRecurrence: {} });
  if (!list.some(item => item.weeklyRecurrence)) await call(`${database}/backupSchedules`, 'POST', { retention: `${98 * DAY}s`, weeklyRecurrence: { day: 'SUNDAY' } });
  console.log('Sauvegardes programmées : chaque jour (14 jours) et chaque dimanche (14 semaines).');
} else if (command === 'restore-test') {
  const [latest] = (await backups()).filter(item => item.state === 'READY');
  if (!latest) throw new Error('Aucune sauvegarde prête : attendez la première sauvegarde quotidienne.');
  const operation = await call(`${project}/databases:restore`, 'POST', { databaseId: RESTORE_TEST, backup: latest.name });
  console.log(`Restauration de la sauvegarde du ${latest.snapshotTime} lancée dans la base séparée « ${RESTORE_TEST} » (${operation.name}).`);
} else if (command === 'drop-restore-test') {
  await call(`${project}/databases/${RESTORE_TEST}`, 'DELETE');
  console.log(`Base de test « ${RESTORE_TEST} » supprimée.`);
} else {
  console.error('Commande inconnue. Utilisez status, enable, restore-test ou drop-restore-test.');
  process.exit(1);
}
