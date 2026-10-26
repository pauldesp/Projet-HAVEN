import type { AuthMailKind, ResendTemplate } from './resendTemplates';
import { authResendTemplate } from './resendTemplates';

export interface AuthMailLimit { nextAt: number; windowAt: number; count: number }
export function nextAuthMailLimit(previous: AuthMailLimit | undefined, now: number): AuthMailLimit | undefined {
  if (previous && now < previous.nextAt) return undefined;
  const sameWindow = previous && now - previous.windowAt < 15 * 60_000;
  if (sameWindow && previous.count >= 5) return undefined;
  return { nextAt: now + 60_000, windowAt: sameWindow ? previous.windowAt : now, count: sameWindow ? previous.count + 1 : 1 };
}
interface AuthMailActions {
  claim: () => Promise<boolean>;
  generate: () => Promise<string>;
  send: (content: ResendTemplate) => Promise<void>;
}
export async function sendAuthActionMail(kind: AuthMailKind, name: string, authDomain: string, actions: AuthMailActions) {
  if (!await actions.claim()) return false;
  const actionLink = await actions.generate();
  const content = authResendTemplate(kind, name, actionLink, authDomain);
  await actions.send(content);
  return true;
}
