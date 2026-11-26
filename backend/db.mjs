export function databaseConfig(env = process.env) {
  const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter(key => !env[key]);
  if (missing.length) throw new Error(`Falta configuración MariaDB: ${missing.join(', ')}`);
  const port = Number(env.DB_PORT ?? 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT inválido');
  return {
    host: env.DB_HOST,
    port,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    charset: 'utf8mb4',
    timezone: 'Z',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 100,
    multipleStatements: false,
    enableKeepAlive: true,
  };
}

export async function createDatabasePool(env = process.env) {
  const { default: mysql } = await import('mysql2/promise');
  return mysql.createPool(databaseConfig(env));
}
