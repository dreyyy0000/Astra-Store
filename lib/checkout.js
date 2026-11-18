import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getPool } from "./db.js";

const catalogUrl = new URL("../catalog.json", import.meta.url);

function checkoutError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function readCatalog() {
  return JSON.parse(await readFile(catalogUrl, "utf8"));
}

export function isValidCpf(value) {
  const cpf = String(value || "").replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]);
}

export function validateBuyer(input = {}) {
  const name = typeof input.buyerName === "string" ? input.buyerName.trim() : "";
  const email = typeof input.buyerEmail === "string" ? input.buyerEmail.trim().toLowerCase() : "";
  const cpf = String(input.buyerCpf || "").replace(/\D/g, "");
  const phone = String(input.buyerPhone || "").replace(/\D/g, "").slice(0, 15);
  const postalCode = String(input.postalCode || "").replace(/\D/g, "");
  const street = typeof input.street === "string" ? input.street.trim() : "";
  const number = typeof input.addressNumber === "string" ? input.addressNumber.trim() : "";
  const complement = typeof input.complement === "string" ? input.complement.trim() : "";
  const neighborhood = typeof input.neighborhood === "string" ? input.neighborhood.trim() : "";
  const city = typeof input.city === "string" ? input.city.trim() : "";
  const state = typeof input.state === "string" ? input.state.trim().toUpperCase() : "";

  if (name.length < 2 || name.length > 120) throw checkoutError("Informe o nome completo do comprador.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) throw checkoutError("Informe um e-mail válido.");
  if (!isValidCpf(cpf)) throw checkoutError("Informe um CPF válido com 11 números.");
  if (phone && (phone.length < 10 || phone.length > 15)) throw checkoutError("Informe um telefone válido ou deixe o campo em branco.");
  if (postalCode.length !== 8) throw checkoutError("Informe um CEP válido com 8 números.");
  if (street.length < 3 || street.length > 180) throw checkoutError("Informe o nome da rua ou avenida.");
  if (!number || number.length > 20) throw checkoutError("Informe o número do endereço.");
  if (complement.length > 100) throw checkoutError("O complemento deve ter até 100 caracteres.");
  if (neighborhood.length < 2 || neighborhood.length > 100) throw checkoutError("Informe o bairro.");
  if (city.length < 2 || city.length > 100) throw checkoutError("Informe a cidade.");
  if (!/^[A-Z]{2}$/.test(state)) throw checkoutError("Informe a UF com duas letras.");

  return {
    name, email, cpf, phone: phone || null,
    address: { postalCode, street, number, complement: complement || null, neighborhood, city, state }
  };
}

export function calculateCart(catalog, rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 20) {
    throw checkoutError("O carrinho está vazio ou contém itens demais.");
  }
  const products = new Map((catalog.products || []).map(product => [product.id, product]));
  const quantitiesBySku = new Map();

  for (const rawItem of rawItems) {
    const product = products.get(rawItem?.id);
    const quantity = Number(rawItem?.quantity);
    const size = String(rawItem?.size || "").trim();
    if (!product || product.active === false) throw checkoutError("Um dos produtos não está disponível.", 409);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw checkoutError(`Quantidade inválida para ${product.name}.`);
    if (!Array.isArray(product.sizes) || !product.sizes.includes(size)) throw checkoutError(`Tamanho inválido para ${product.name}.`);
    const sku = `${product.id}::${size}`;
    const accumulated = (quantitiesBySku.get(sku)?.quantity || 0) + quantity;
    if (accumulated > 20) throw checkoutError(`Quantidade total inválida para ${product.name}, tamanho ${size}.`);
    quantitiesBySku.set(sku, { product, size, quantity: accumulated });
  }

  const items = [];
  let totalCents = 0;
  for (const { product, size, quantity } of quantitiesBySku.values()) {
    const available = Number(product.stockBySize?.[size] ?? product.stock ?? 0);
    if (!Number.isInteger(available) || available < quantity) throw checkoutError(`Estoque insuficiente para ${product.name}, tamanho ${size}.`, 409);
    if (!Number.isFinite(Number(product.price)) || Number(product.price) <= 0) throw checkoutError(`Preço inválido cadastrado para ${product.name}.`, 409);
    const unitPriceCents = Math.round(Number(product.price) * 100);
    const lineTotalCents = unitPriceCents * quantity;
    totalCents += lineTotalCents;
    items.push({
      productId: String(product.id), productName: String(product.name), size, quantity,
      unitPriceCents, lineTotalCents
    });
  }
  if (totalCents <= 0 || totalCents > 100000000) throw checkoutError("O valor total do pedido é inválido.");
  return { items, totalCents, totalAmount: Number((totalCents / 100).toFixed(2)) };
}

// Grava o pedido e os dados de entrega assim que o comprador avança para a etapa do cartão.
export async function createCheckoutOrder({ buyer, cart }) {
  const pool = getPool();
  const connection = await pool.getConnection();
  const publicId = `ASTRA-${randomUUID()}`;

  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO customers (full_name, email, cpf, phone)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), cpf = VALUES(cpf),
         phone = VALUES(phone), updated_at = CURRENT_TIMESTAMP`,
      [buyer.name, buyer.email, buyer.cpf, buyer.phone]
    );
    const [customerRows] = await connection.execute(
      "SELECT id FROM customers WHERE email = ? LIMIT 1", [buyer.email]
    );
    if (!customerRows.length) throw new Error("Não foi possível registrar o comprador.");

    const address = buyer.address;
    const [orderResult] = await connection.execute(
      `INSERT INTO orders
        (public_id, customer_id, subtotal, total_amount, currency, order_status, payment_status,
         payment_method, shipping_cep, shipping_street, shipping_number, shipping_complement,
         shipping_neighborhood, shipping_city, shipping_state)
       VALUES (?, ?, ?, ?, 'BRL', 'awaiting_card_details', 'not_processed', 'card', ?, ?, ?, ?, ?, ?, ?)`,
      [publicId, customerRows[0].id, cart.totalAmount, cart.totalAmount,
        address.postalCode, address.street, address.number, address.complement,
        address.neighborhood, address.city, address.state]
    );
    const orderId = orderResult.insertId;

    for (const item of cart.items) {
      await connection.execute(
        `INSERT INTO order_items (order_id, product_id, product_name, product_size, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.productId, item.productName, item.size, item.quantity,
          (item.unitPriceCents / 100).toFixed(2), (item.lineTotalCents / 100).toFixed(2)]
      );
    }

    const [paymentResult] = await connection.execute(
      `INSERT INTO payments (order_id, provider, payment_method, status, amount, currency, status_detail)
       VALUES (?, 'manual_offline', 'card', 'awaiting_card_summary', ?, 'BRL', 'no_payment_processor_configured')`,
      [orderId, cart.totalAmount]
    );
    await connection.commit();
    return { orderId, paymentRowId: paymentResult.insertId, publicId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Guarda apenas metadados não sensíveis. PAN, validade e CVV nunca são enviados ao servidor.
export async function finalizeOrder({ publicId, cardInfo }) {
  const cardholderName = String(cardInfo?.cardholderName || "").trim();
  const brand = String(cardInfo?.brand || "").toLowerCase();
  const lastFour = String(cardInfo?.lastFour || "");
  const cardType = String(cardInfo?.cardType || "").toLowerCase();
  const installments = Number(cardInfo?.installments);
  const brands = new Set(["visa", "mastercard", "elo", "amex", "hipercard", "other"]);
  if (!/^ASTRA-[0-9a-f-]{36}$/i.test(String(publicId || ""))) throw checkoutError("Referência do pedido inválida.");
  if (cardholderName.length < 2 || cardholderName.length > 120) throw checkoutError("Informe o nome impresso no cartão.");
  if (!brands.has(brand)) throw checkoutError("Selecione a bandeira do cartão.");
  if (!/^\d{4}$/.test(lastFour)) throw checkoutError("Informe os quatro últimos dígitos do cartão.");
  if (!["credit", "debit"].includes(cardType)) throw checkoutError("Selecione crédito ou débito.");
  if (!Number.isInteger(installments) || installments < 1 || installments > 12 || (cardType === "debit" && installments !== 1)) {
    throw checkoutError("Quantidade de parcelas inválida.");
  }

  const [result] = await getPool().execute(
    `UPDATE payments p
     JOIN orders o ON o.id = p.order_id
     SET p.cardholder_name = ?, p.card_brand = ?, p.card_last_four = ?, p.installments = ?,
         p.payment_method = ?, p.status = 'not_processed',
         p.status_detail = 'payment_processor_not_configured',
         o.order_status = 'received', o.payment_status = 'not_processed',
         o.payment_method = ?, o.updated_at = CURRENT_TIMESTAMP
     WHERE o.public_id = ? AND p.provider = 'manual_offline'
       AND o.order_status = 'awaiting_card_details'`,
    [cardholderName, brand, lastFour, installments, cardType === "credit" ? "credit_card" : "debit_card",
      cardType === "credit" ? "credit_card" : "debit_card", publicId]
  );
  if (!result.affectedRows) throw checkoutError("Pedido não encontrado ou já finalizado.", 404);
  const [rows] = await getPool().execute(
    "SELECT public_id, total_amount FROM orders WHERE public_id = ? LIMIT 1", [publicId]
  );
  if (!rows.length) throw checkoutError("Não foi possível localizar o pedido.", 404);
  return { publicId: rows[0].public_id, totalAmount: Number(rows[0].total_amount) };
}
