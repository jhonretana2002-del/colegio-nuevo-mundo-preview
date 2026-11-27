import { startSession, revokeSession } from './auth-store.mjs';

export async function withAdminOperator(pool, credentials, operation, auth = { startSession, revokeSession }) {
  if (typeof operation !== 'function') throw new Error('Operación de cuenta inválida.');
  const session = await auth.startSession(pool, credentials);
  if (!session) throw new Error('No se pudo verificar la cuenta Admin y su código MFA.');
  try {
    if (session.role !== 'admin' || !session.actorId) throw new Error('Solo una cuenta Admin puede gestionar usuarios.');
    return await operation(session.actorId);
  } finally {
    await auth.revokeSession(pool, session.token);
  }
}
