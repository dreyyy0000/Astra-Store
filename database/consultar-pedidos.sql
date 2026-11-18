-- Consulte pedidos, compradores, entrega e metadados não sensíveis do cartão.
USE astra_store;

SELECT
  o.public_id AS pedido,
  o.created_at AS data_pedido,
  c.full_name AS cliente,
  c.email,
  c.cpf,
  c.phone AS telefone,
  CONCAT(o.shipping_cep, ' - ', o.shipping_street, ', ', o.shipping_number,
    IFNULL(CONCAT(' - ', o.shipping_complement), ''), ', ', o.shipping_neighborhood,
    ', ', o.shipping_city, '/', o.shipping_state) AS endereco_entrega,
  o.total_amount AS total,
  o.order_status AS status_pedido,
  o.payment_status AS status_pagamento,
  o.payment_method AS tipo_cartao,
  p.cardholder_name AS titular_cartao,
  p.card_brand AS bandeira,
  p.card_last_four AS final_cartao,
  p.installments AS parcelas
FROM orders o
JOIN customers c ON c.id = o.customer_id
LEFT JOIN payments p ON p.order_id = o.id
ORDER BY o.created_at DESC;
