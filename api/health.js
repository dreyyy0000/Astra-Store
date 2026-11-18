import { assertDatabaseReady } from "../lib/db.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ message: "Use GET para consultar a conexão." });
  }
  try {
    await assertDatabaseReady();
    return response.status(200).json({ ok: true, database: "connected" });
  } catch (error) {
    console.error("MySQL health check failed:", error.message);
    return response.status(503).json({
      ok: false,
      database: "disconnected",
      message: "A API está ativa, mas não conectou ao MySQL. Confira as variáveis de ambiente e as tabelas."
    });
  }
}
