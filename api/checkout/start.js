import {
  calculateCart,
  createCheckoutOrder,
  readCatalog,
  validateBuyer
} from "../../lib/checkout.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ message: "Método não permitido." });
  }
  try {
    const buyer = validateBuyer(request.body?.buyer || {});
    const catalog = await readCatalog();
    const cart = calculateCart(catalog, request.body?.items);
    const order = await createCheckoutOrder({ buyer, cart });
    return response.status(201).json({
      orderReference: order.publicId,
      totalAmount: cart.totalAmount,
      currency: "BRL",
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0)
    });
  } catch (error) {
    console.error("Checkout start failed:", error.message);
    const isDbError = Boolean(error.code) || error.message?.startsWith("Banco MySQL não configurado");
    return response.status(error.statusCode || (isDbError ? 503 : 400)).json({
      message: isDbError
        ? "Não foi possível gravar o pedido no MySQL. Confira a conexão e execute database/schema.sql."
        : (error.message || "Não foi possível iniciar o pedido.")
    });
  }
}
