import { finalizeOrder } from "../../lib/checkout.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ message: "Método não permitido." });
  }
  try {
    // Permite somente metadados. Campos como cardNumber, cvv, expiry ou PAN são rejeitados.
    const body = request.body || {};
    const forbidden = ["cardNumber", "number", "pan", "cvv", "securityCode", "expiry", "expirationDate", "token"];
    if (forbidden.some(key => Object.hasOwn(body.cardInfo || {}, key))) {
      return response.status(400).json({ message: "Por segurança, não envie número completo, validade ou código de segurança do cartão." });
    }
    const order = await finalizeOrder({
      publicId: body.orderReference,
      cardInfo: body.cardInfo
    });
    return response.status(200).json({
      success: true,
      orderReference: order.publicId,
      totalAmount: order.totalAmount,
      paymentStatus: "not_processed",
      message: "Pedido registrado. Nenhuma cobrança foi realizada porque não há um processador de pagamentos conectado."
    });
  } catch (error) {
    console.error("Checkout completion failed:", error.message);
    const isDbError = Boolean(error.code) || error.message?.startsWith("Banco MySQL não configurado");
    return response.status(error.statusCode || (isDbError ? 503 : 400)).json({
      message: isDbError ? "Não foi possível atualizar o pedido no MySQL." : (error.message || "Não foi possível concluir o pedido.")
    });
  }
}
