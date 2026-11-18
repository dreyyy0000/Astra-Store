import mysql from "mysql2/promise";

let pool;

function databaseConfig() {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
      queueLimit: 0,
      charset: "utf8mb4",
      timezone: "Z",
      ssl: url.searchParams.get("ssl") === "true"
        ? { rejectUnauthorized: true }
        : undefined
    };
  }

  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error(
      "Banco MySQL não configurado. Defina DATABASE_URL ou DB_HOST, DB_USER, DB_PASSWORD e DB_NAME."
    );
  }

  return {
    host: DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: DB_USER,
    password: DB_PASSWORD || "",
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
    queueLimit: 0,
    charset: "utf8mb4",
    timezone: "Z",
    ssl: process.env.DB_SSL === "true"
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
      : undefined
  };
}

export function getPool() {
  if (!pool) pool = mysql.createPool(databaseConfig());
  return pool;
}

export async function assertDatabaseReady() {
  const connection = await getPool().getConnection();
  try {
    await connection.query("SELECT 1");
  } finally {
    connection.release();
  }
}
