-- Migração para o checkout manual sem processador externo. Execute uma única vez
-- no MySQL Workbench, em uma base criada pela versão anterior do Astra Store.
USE astra_store;

ALTER TABLE customers
  ADD COLUMN cpf CHAR(11) NULL AFTER email;

ALTER TABLE orders
  ADD COLUMN shipping_cep CHAR(8) NULL,
  ADD COLUMN shipping_street VARCHAR(180) NULL,
  ADD COLUMN shipping_number VARCHAR(20) NULL,
  ADD COLUMN shipping_complement VARCHAR(100) NULL,
  ADD COLUMN shipping_neighborhood VARCHAR(100) NULL,
  ADD COLUMN shipping_city VARCHAR(100) NULL,
  ADD COLUMN shipping_state CHAR(2) NULL;

ALTER TABLE payments
  DROP INDEX uq_payments_provider_id,
  DROP COLUMN provider_payment_id,
  DROP COLUMN provider_response,
  MODIFY COLUMN provider VARCHAR(40) NOT NULL DEFAULT 'manual_offline';

UPDATE payments
SET provider = 'manual_offline',
    status = CASE
      WHEN status IN ('approved', 'refunded', 'charged_back') THEN status
      ELSE 'not_processed'
    END,
    status_detail = 'legacy_payment_not_reprocessed';

UPDATE orders o
JOIN payments p ON p.order_id = o.id
SET o.payment_status = 'not_processed',
    o.order_status = 'received'
WHERE p.status = 'not_processed'
  AND o.payment_status IN ('pending', 'processing', 'in_process', 'authorized');
