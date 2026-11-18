import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const catalogUrl = new URL("../catalog.json", import.meta.url);

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ message: "Método não permitido." });
  }

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    return response.status(503).json({ message: "O pagamento ainda não foi configurado. Adicione MP_ACCESS_TOKEN nas variáveis de ambiente da Vercel." });
  }

  let catalog;
  try {
    catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
  } catch {
    return response.status(500).json({ message: "Não foi possível carregar o catálogo da loja." });
  }

  if (catalog.demoData) {
    return response.status(409).json({ message: "O catálogo ainda contém preços e estoque de demonstração. Atualize catalog.json e defina demoData como false antes de ativar cobranças." });
  }

  const { buyerName, buyerEmail, items, paymentPreference = "mercadopago" } = request.body || {};
  if (typeof buyerName !== "string" || buyerName.trim().length < 2) {
    return response.status(400).json({ message: "Informe o nome do comprador." });
  }
  if (typeof buyerEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
    return response.status(400).json({ message: "Informe um e-mail válido." });
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    return response.status(400).json({ message: "O carrinho está vazio ou contém itens demais." });
  }

  const products = new Map((catalog.products || []).map(product => [product.id, product]));
  const orderItems = [];
  let totalCents = 0;

  for (const item of items) {
    const product = products.get(item?.id);
    const quantity = Number(item?.quantity);
    const size = String(item?.size || "");

    if (!product || product.active === false) {
      return response.status(400).json({ message: "Um dos produtos não está disponível." });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return response.status(400).json({ message: `Quantidade inválida para ${product.name}.` });
    }
    if (!Array.isArray(product.sizes) || !product.sizes.includes(size)) {
      return response.status(400).json({ message: `Tamanho inválido para ${product.name}.` });
    }
    const availableForSize = Number(product.stockBySize?.[size] ?? product.stock ?? 0);
    if (!Number.isInteger(availableForSize) || availableForSize < quantity) {
      return response.status(409).json({ message: `Estoque insuficiente para ${product.name}, tamanho ${size}.` });
    }
    if (!Number.isFinite(product.price) || product.price <= 0) {
      return response.status(400).json({ message: `Preço inválido cadastrado para ${product.name}.` });
    }

    const unitPriceCents = Math.round(Number(product.price) * 100);
    totalCents += unitPriceCents * quantity;
    orderItems.push({
      title: `${product.name} — tamanho ${size}`,
      quantity,
      unit_price: (unitPriceCents / 100).toFixed(2)
    });
  }

  if (totalCents <= 0 || totalCents > 100000000) {
    return response.status(400).json({ message: "O valor total do pedido é inválido." });
  }

  const siteUrl = process.env.SITE_URL
    ? process.env.SITE_URL.replace(/\/$/, "")
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : null;

  if (!siteUrl || !/^https:\/\//.test(siteUrl)) {
    return response.status(503).json({ message: "Configure SITE_URL com o endereço HTTPS da sua loja na Vercel." });
  }

  if (!["card", "mercadopago"].includes(paymentPreference)) {
    return response.status(400).json({ message: "Forma de pagamento inválida para o Mercado Pago." });
  }

  const orderId = `ASTRA-${randomUUID()}`;
  const config = {
    online: {
      success_url: `${siteUrl}/?checkout=approved`,
      pending_url: `${siteUrl}/?checkout=pending`,
      failure_url: `${siteUrl}/?checkout=failure`,
      auto_return: "approved"
    }
  };
  if (paymentPreference === "card") {
    config.payment_method = {
      not_allowed_types: ["bank_transfer", "ticket", "account_money", "wallet", "digital_currency"]
    };
  }

  const payload = {
    type: "online",
    processing_mode: "manual",
    capture_mode: "automatic_async",
    total_amount: (totalCents / 100).toFixed(2),
    external_reference: orderId,
    description: `Pedido ${orderId} — Astra Store`,
    payer: { email: buyerEmail.trim() },
    items: orderItems,
    config
  };

  try {
    const mpResponse = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Idempotency-Key": randomUUID()
      },
      body: JSON.stringify(payload)
    });
    const data = await mpResponse.json().catch(() => ({}));
    if (!mpResponse.ok) {
      console.error("Mercado Pago order error", mpResponse.status, data);
      return response.status(502).json({ message: "O Mercado Pago não conseguiu iniciar o pagamento. Verifique as credenciais e a configuração da aplicação." });
    }
    if (!data.checkout_url) {
      console.error("Mercado Pago response without checkout_url", data);
      return response.status(502).json({ message: "O Mercado Pago não retornou o endereço de pagamento." });
    }
    return response.status(201).json({ checkoutUrl: data.checkout_url, orderId: data.id, externalReference: orderId });
  } catch (error) {
    console.error("Create order failed", error);
    return response.status(500).json({ message: "Falha de comunicação com o serviço de pagamento." });
  }
}
