import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createDatabasePool } from './db.mjs';
import { withAdminOperator } from './account-operator.mjs';
import { createAccount, replaceMfa, resetPassword } from './account-provision.mjs';
import { createLoginGate } from './login-limit.mjs';
import { base32, enrollmentUri, generateMfaSecret } from './mfa.mjs';

const actions = new Set(['crear-moderador', 'crear-admin', 'restablecer-clave', 'reemplazar-mfa']);

async function main() {
  const action = process.argv[2];
  if (!actions.has(action)) throw new Error('Uso: node manage-accounts.mjs crear-moderador|crear-admin|restablecer-clave|reemplazar-mfa');
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Esta operación requiere una terminal privada e interactiva.');
  const mfaKey = process.env.MFA_ENCRYPTION_KEY;
  if (!/^[0-9a-fA-F]{64}$/.test(mfaKey ?? '')) throw new Error('Configure MFA_ENCRYPTION_KEY con 64 caracteres hexadecimales.');
  if ((process.env.LOGIN_LIMIT_SECRET ?? '').length < 32) throw new Error('Configure LOGIN_LIMIT_SECRET con al menos 32 caracteres.');
  let muted = false;
  const output = new Writable({ write(chunk, _encoding, done) { if (!muted) process.stdout.write(chunk); done(); } });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  async function secret(label) {
    process.stdout.write(`${label} (no se mostrará): `);
    muted = true;
    try { return await rl.question(''); }
    finally { muted = false; process.stdout.write('\n'); }
  }
  async function newPassword() {
    const password = await secret('Nueva contraseña');
    const confirmation = await secret('Repita la contraseña');
    if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
    return password;
  }
  async function newMfa(email) {
    const mfaSecret = generateMfaSecret();
    process.stdout.write('\nConfigure la aplicación de autenticación de la persona destinataria con este código privado:\n');
    process.stdout.write(`${base32(mfaSecret)}\n${enrollmentUri(email, mfaSecret)}\n`);
    const confirmationCode = (await rl.question('Código de seis dígitos de esa aplicación: ')).trim();
    return { mfaSecret, confirmationCode };
  }
  const pool = await createDatabasePool();
  try {
    const email = (await rl.question('Correo de la persona Admin que autoriza: ')).trim();
    if (!(await createLoginGate(pool, process.env.LOGIN_LIMIT_SECRET)({ email, ip: '127.0.0.1' }))) {
      throw new Error('Demasiados intentos. Intente más tarde.');
    }
    const password = await secret('Contraseña de Admin');
    const totp = (await rl.question('Código MFA de Admin: ')).trim();
    await withAdminOperator(pool, { email, password, totp, mfaKey }, async operatorId => {
      const targetEmail = (await rl.question('Correo de la cuenta destinataria: ')).trim().toLowerCase();
      let userId;
      if (action === 'restablecer-clave' || action === 'reemplazar-mfa') {
        const [users] = await pool.execute('SELECT id FROM admin_users WHERE email = ? AND active = TRUE LIMIT 1', [targetEmail]);
        if (!users.length) throw new Error('Cuenta activa no encontrada.');
        userId = users[0].id;
      }
      let reason;
      if (action === 'restablecer-clave' || action === 'reemplazar-mfa') {
        process.stdout.write('Verifique la identidad de la persona destinataria por el procedimiento del colegio.\n');
        reason = (await rl.question('Motivo de la recuperación (mínimo 10 caracteres): ')).trim();
      }
      const confirmed = (await rl.question('Escriba CONFIRMO para ejecutar la operación: ')).trim();
      if (confirmed !== 'CONFIRMO') throw new Error('Operación cancelada.');
      if (action === 'crear-moderador' || action === 'crear-admin') {
        const role = action === 'crear-admin' ? 'admin' : 'moderador';
        const targetPassword = await newPassword();
        const mfa = await newMfa(targetEmail);
        const result = await createAccount(pool, { email: targetEmail, password: targetPassword, role, ...mfa, mfaKey, operatorId });
        process.stdout.write(`Cuenta ${role} creada: ${result.id}\n`);
      } else if (action === 'restablecer-clave') {
        const targetPassword = await newPassword();
        await resetPassword(pool, { userId, newPassword: targetPassword, operatorId, operatorName: email, reason });
        process.stdout.write('Contraseña restablecida y sesiones anteriores revocadas.\n');
      } else {
        const mfa = await newMfa(targetEmail);
        await replaceMfa(pool, { userId, ...mfa, mfaKey, operatorId, operatorName: email, reason });
        process.stdout.write('MFA reemplazado y sesiones anteriores revocadas.\n');
      }
      process.stdout.write('Cierre esta terminal para retirar contraseñas y códigos de la pantalla.\n');
    });
  } finally { muted = false; rl.close(); await pool.end(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
