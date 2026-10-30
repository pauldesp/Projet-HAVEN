import Stripe from 'stripe';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Development only: never accept a live key, and never print API/signature secrets.
const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, '.stripe-local/tools/node_modules/.bin/stripe');
if (process.env.NODE_ENV === 'production' || !/^sk_test_[a-zA-Z0-9]+$/.test(process.env.STRIPE_SECRET_KEY || '') || process.env.PAYMENT_MODE !== 'stripe') {
  throw new Error('Ce démarrage exige PAYMENT_MODE=stripe et une clé Stripe de test. Aucune clé live n’est autorisée.');
}
if (!existsSync(cli)) throw new Error('Installez le CLI officiel : npm install --prefix .stripe-local/tools --no-package-lock --no-save @stripe/cli');
if (!/^acct_[a-zA-Z0-9]+$/.test(process.env.STRIPE_SANDBOX_ACCOUNT_ID || '')) throw new Error('Identifiant de la Sandbox Stripe manquant.');
const sandboxAccount = await new Stripe(process.env.STRIPE_SECRET_KEY).accounts.retrieve();
if (sandboxAccount.id !== process.env.STRIPE_SANDBOX_ACCOUNT_ID) throw new Error('La clé ne correspond pas à la Sandbox configurée.');
let server, ready = false, stopping = false;
const listener = spawn(cli, ['--config', path.join(root, '.stripe-local/config.toml'), 'listen', '--all-snapshot', '--events-from', 'all',
  '--forward-to', 'http://localhost:3000/api/stripe/webhook',
  '--forward-connect-to', 'http://localhost:3000/api/stripe/connect-webhook', '--skip-update'], {
  cwd: root, env: { ...process.env, STRIPE_API_KEY: process.env.STRIPE_SECRET_KEY }, stdio: ['ignore', 'pipe', 'pipe']
});
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  server?.kill('SIGTERM'); listener.kill('SIGTERM');
  process.exitCode = code;
};
let pending = '';
const receive = chunk => {
  pending = (pending + chunk.toString()).slice(-16000);
  const secret = pending.match(/whsec_[a-zA-Z0-9]+/)?.[0];
  if (secret && !ready) {
    ready = true;
    const envPath = path.join(root, '.env');
    let content = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
    for (const name of ['STRIPE_WEBHOOK_SECRET', 'STRIPE_CONNECT_WEBHOOK_SECRET']) {
      const pattern = new RegExp(`^${name}=.*$`, 'm');
      content = pattern.test(content) ? content.replace(pattern, `${name}=${secret}`) : `${content.trimEnd()}\n${name}=${secret}\n`;
    }
    const temporary = `${envPath}.stripe-tmp`;
    writeFileSync(temporary, content, { mode: 0o600 }); renameSync(temporary, envPath);
    console.log('Notifications Stripe de test connectées. Démarrage de Haven…');
    server = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { cwd: root,
      env: { ...process.env, STRIPE_WEBHOOK_SECRET: secret, STRIPE_CONNECT_WEBHOOK_SECRET: secret }, stdio: 'inherit' });
    server.on('exit', code => stop(code || 0));
    server.on('error', () => { console.error('Le serveur Haven n’a pas pu démarrer.'); stop(1); });
  }
  // Only log delivery summaries, never raw provider output containing credentials.
  for (const line of chunk.toString().split('\n')) {
    if (line.includes('-->') || line.includes('<--')) console.log(line.replace(/(?:sk|rk|pk)_(?:test|live)_[a-zA-Z0-9]+|whsec_[a-zA-Z0-9]+/g, '[secret masqué]'));
  }
};
listener.stdout.on('data', receive); listener.stderr.on('data', receive);
listener.on('error', () => { console.error('Impossible de lancer le relais Stripe.'); stop(1); });
listener.on('exit', code => { if (!stopping) { console.error('Le relais Stripe est arrêté. Relancez npm run dev:stripe pour rétablir les notifications.'); console.error(pending.replace(/(?:sk|rk|pk)_(?:test|live)_[a-zA-Z0-9]+|whsec_[a-zA-Z0-9]+/g, '[secret masqué]').slice(-2500)); stop(code || 1); } });
const timeout = setTimeout(() => { if (!ready) { console.error('Connexion Stripe indisponible après 45 secondes. Vérifiez la clé et la connexion réseau.'); stop(1); } }, 45000);
timeout.unref();
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
