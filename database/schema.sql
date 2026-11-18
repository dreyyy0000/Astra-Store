-- ASTRA STORE | Banco de pedidos, compradores, endereço de entrega e metadados de pagamento
-- Execute este arquivo no MySQL Workbench.

CREATE DATABASE IF NOT EXISTS astra_store
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE astra_store;

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  cpf CHAR(11) NULL,
  phone VARCHAR(30) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_email (email),
  KEY idx_customers_created_at (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id VARCHAR(50) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  shipping_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  order_status VARCHAR(40) NOT NULL DEFAULT 'awaiting_payment',
  payment_status VARCHAR(40) NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(30) NOT NULL,
  customer_note VARCHAR(500) NULL,
  shipping_cep CHAR(8) NOT NULL,
  shipping_street VARCHAR(180) NOT NULL,
  shipping_number VARCHAR(20) NOT NULL,
  shipping_complement VARCHAR(100) NULL,
  shipping_neighborhood VARCHAR(100) NOT NULL,
  shipping_city VARCHAR(100) NOT NULL,
  shipping_state CHAR(2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_public_id (public_id),
  KEY idx_orders_customer (customer_id),
  KEY idx_orders_status (order_status, payment_status),
  KEY idx_orders_created_at (created_at),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id VARCHAR(80) NOT NULL,
  product_name VARCHAR(180) NOT NULL,
  product_size VARCHAR(30) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'manual_offline',
  payment_method VARCHAR(30) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  status_detail VARCHAR(100) NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'BRL',
  cardholder_name VARCHAR(120) NULL,
  card_brand VARCHAR(40) NULL,
  card_last_four CHAR(4) NULL,
  installments SMALLINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payments_order (order_id),
  KEY idx_payments_status (status),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Conferência administrativa rápida (opcional):
-- SELECT o.public_id, c.full_name, c.email, o.total_amount,
--        o.payment_method, o.payment_status, o.order_status, o.created_at
-- FROM orders o JOIN customers c ON c.id = o.customer_id
-- ORDER BY o.created_at DESC;
