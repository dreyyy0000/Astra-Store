-- Execute uma única vez em bancos já existentes, depois das migrações 001 e 002.
USE astra_store;

ALTER TABLE payments
  ADD COLUMN cardholder_name VARCHAR(120) NULL AFTER status_detail;
