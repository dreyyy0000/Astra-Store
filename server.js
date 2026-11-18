import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import startCheckoutHandler from "./api/checkout/start.js";
import completeCheckoutHandler from "./api/checkout/complete.js";
import { assertDatabaseReady } from "./lib/db.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const rootDir = dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));
app.use(express.json({ limit: "32kb", strict: true }));

// Health check também verifica a conexão com o MySQL.
app.get("/api/health", async (_request, response) => {
  try {
    await assertDatabaseReady();
    return response.status(200).json({ ok: true, database: "connected" });
  } catch (error) {
    console.error("MySQL health check failed:", error.message);
    return response.status(503).json({
      ok: false,
      database: "disconnected",
      message: "Servidor ativo, mas o MySQL não está conectado. Confira o arquivo .env e execute database/schema.sql no Workbench."
    });
  }
});

// As rotas abaixo precisam receber POST. Não abra a loja pelo Live Server.
app.post("/api/checkout/start", startCheckoutHandler);
app.post("/api/checkout/complete", completeCheckoutHandler);

app.all("/api/checkout/start", (_request, response) => {
  response.setHeader("Allow", "POST");
  return response.status(405).json({ message: "Use POST para iniciar o pedido." });
});
app.all("/api/checkout/complete", (_request, response) => {
  response.setHeader("Allow", "POST");
  return response.status(405).json({ message: "Use POST para finalizar o pedido." });
});
app.all("/api/*", (_request, response) => {
  return response.status(404).json({
    message: "Rota da API não encontrada. Inicie a loja pelo servidor Node.js, não pelo Live Server."
  });
});

app.use(express.static(rootDir, { extensions: ["html"] }));
app.get("*", (_request, response) => response.sendFile(resolve(rootDir, "index.html")));

app.use((error, _request, response, _next) => {
  console.error("HTTP error:", error.message);
  const status = error instanceof SyntaxError && error.status === 400 ? 400 : 500;
  response.status(status).json({
    message: status === 400 ? "O navegador enviou dados em formato inválido." : "Erro interno do servidor. Consulte o terminal onde a loja foi iniciada."
  });
});

app.listen(port, () => {
  console.log(`Astra Store disponível em http://localhost:${port}`);
  console.log("Use esta URL no navegador; não use a extensão Live Server.");
});
