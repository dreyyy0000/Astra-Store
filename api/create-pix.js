import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";

const catalogUrl = new URL("../catalog.json", import.meta.url);

function tlv(id, value) {
  const text = String(value);
  const length = Buffer.byteLength(text, "utf8");
  if (length > 99) throw new Error(`Campo Pix ${id} excede o tamanho permitido.`);
  return `${id}${String(length).padStart(2, "0")}${text}`;
}

function crc16(payload) {
  let crc = 0xffff;
  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function normalizePhonePixKey(rawKey) {
  const digits = String(rawKey || "").replace(/\D/g, "");
  let internationalDigits = digits;
  if (digits.length === 10 || digits.length === 11) internationalDigits = `55${digits}`;
  if (!internationalDigits.startsWith("55") || ![12, 13].includes(internationalDigits.length)) {
    throw new Error("A chave Pix de telefone precisa estar no formato brasileiro com DDD. Confira PIX_KEY nas variáveis de ambiente.");
  }
  return `+${internationalDigits}`;
}

function cleanMerchantField(value, maxLength, fieldName) {
  const cleaned = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length > maxLength) {
    throw new Error(`${fieldName} precisa ter entre 1 e ${maxLength} caracteres. Ajuste as variáveis de ambiente da Vercel.`);
  }
  return cleaned;
}

function buildPixPayload({ key, amount, merchantName, merchantCity, txid }) {
  const merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", key);
  const additionalData = tlv("05", txid);
  const payloadWithoutCrc = [
    tlv("00", "01"),
    tlv("26", merchantAccount),
    tlv("52", "0000"),
    tlv("53", "986"),
    tlv("54", amount.toFixed(2)),
    tlv("58", "BR"),
    tlv("59", merchantName),
    tlv("60", merchantCity),
    tlv("62", additionalData),
    "6304"
  ].join("");
  return `${payloadWithoutCrc}${crc16(payloadWithoutCrc)}`;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ message: "Método não permitido." });
  }

  let catalog;
  try {
    catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
  } catch {
    return response.status(500).json({ message: "Não foi possível carregar o catálogo da loja." });
  }

  if (catalog.demoData) {
    return response.status(409).json({ message: "O catálogo ainda está em modo de demonstração. Atualize preços e estoque reais em catalog.json e altere demoData para false antes de gerar cobranças." });
  }

  const { buyerName, buyerEmail, items } = request.body || {};
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
    totalCents += Math.round(Number(product.price) * 100) * quantity;
  }

  if (totalCents <= 0 || totalCents > 100000000) {
    return response.status(400).json({ message: "O valor total do pedido é inválido." });
  }

  let pixKey;
  let merchantName;
  let merchantCity;
  try {
    pixKey = normalizePhonePixKey(process.env.PIX_KEY || catalog.pix?.key || "+5511950910692");
    merchantName = cleanMerchantField(process.env.PIX_MERCHANT_NAME || catalog.pix?.merchantName || "ASTRA STORE", 25, "PIX_MERCHANT_NAME");
    const configuredCity = process.env.PIX_MERCHANT_CITY || catalog.pix?.merchantCity || "";
    if (!configuredCity || configuredCity === "INFORME_A_CIDADE_DO_RECEBEDOR") {
      return response.status(503).json({ message: "Falta configurar PIX_MERCHANT_CITY na Vercel com a cidade vinculada à conta que recebe este Pix." });
    }
    merchantCity = cleanMerchantField(configuredCity, 15, "PIX_MERCHANT_CITY");
  } catch (error) {
    return response.status(503).json({ message: error.message || "Verifique a configuração da chave Pix." });
  }

  const txid = `ASTRA${randomBytes(10).toString("hex").toUpperCase()}`.slice(0, 25);
  const totalAmount = totalCents / 100;

  try {
    const pixCopyPaste = buildPixPayload({
      key: pixKey,
      amount: totalAmount,
      merchantName,
      merchantCity,
      txid
    });
    const qrCodeDataUrl = await QRCode.toDataURL(pixCopyPaste, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 280,
      color: { dark: "#07101f", light: "#ffffff" }
    });

    const localDigits = pixKey.replace(/\D/g, "").slice(2);
    const areaCode = localDigits.slice(0, 2);
    const phoneNumber = localDigits.slice(2);
    const formattedPhone = phoneNumber.length === 9
      ? `${phoneNumber.slice(0, 5)}-${phoneNumber.slice(5)}`
      : `${phoneNumber.slice(0, 4)}-${phoneNumber.slice(4)}`;

    return response.status(201).json({
      pixCopyPaste,
      qrCodeDataUrl,
      totalAmount,
      txid,
      pixKeyDisplay: `+55 (${areaCode}) ${formattedPhone}`,
      paymentMode: "static_pix_qr_manual_confirmation"
    });
  } catch (error) {
    console.error("Pix generation failed", error);
    return response.status(500).json({ message: "Não foi possível gerar o QR Code Pix. Verifique a configuração e tente novamente." });
  }
}
