import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { createDatabasePool } from './db.mjs';
import { createAccount } from './account-provision.mjs';
import { base32, enrollmentUri, generateMfaSecret } from './mfa.mjs';

if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('La preparación del primer Admin requiere una terminal privada e interactiva.');
if (!/^[0-9a-fA-F]{64}$/.test(process.env.MFA_ENCRYPTION_KEY ?? '')) throw new Error('Configure MFA_ENCRYPTION_KEY con 64 caracteres hexadecimales.');

let muted = false;
const output = new Writable({ write(chunk, _encoding, done) { if (!muted) process.stdout.write(chunk); done(); } });
const rl = createInterface({ input: process.stdin, output, terminal: true });
let pool;
let lock;
let acquired = false;
try {
  pool = await createDatabasePool();
  lock = await pool.getConnection();
  const [rows] = await lock.query("SELECT GET_LOCK('colegio_first_admin', 15) AS acquired");
  if (rows[0]?.acquired !== 1) throw new Error('No se pudo reservar la preparación de la cuenta.');
  acquired = true;
  const [users] = await lock.query("SELECT COUNT(*) AS total FROM admin_users WHERE role = 'admin'");
  if (Number(users[0].total) !== 0) throw new Error('Ya existe una cuenta Admin. Use el proceso privado de recuperación o alta autorizada.');
  const email = (await rl.question('Correo de la primera persona Admin: ')).trim();
  process.stdout.write('Contraseña (no se mostrará): ');
  muted = true;
  const password = await rl.question('');
  muted = false;
  process.stdout.write('\n');
  const secret = generateMfaSecret();
  process.stdout.write('\nConfigure una aplicación de autenticación con este código privado:\n');
  process.stdout.write(`${base32(secret)}\n`);
  process.stdout.write(`Enlace de inscripción: ${enrollmentUri(email, secret)}\n`);
  const confirmationCode = (await rl.question('Código de seis dígitos de la aplicación: ')).trim();
  const account = await createAccount(pool, { email, password, role: 'admin', mfaSecret: secret, confirmationCode, mfaKey: process.env.MFA_ENCRYPTION_KEY });
  process.stdout.write(`\nCuenta Admin creada. ID para importar el contenido: ${account.id}\n`);
  process.stdout.write('Guarde el ID en un lugar privado y cierre esta terminal para retirar el secreto de la pantalla.\n');
} finally {
  muted = false;
  rl.close();
  try { if (acquired) await lock.query("SELECT RELEASE_LOCK('colegio_first_admin')"); }
  finally { lock?.release(); if (pool) await pool.end(); }
}
