-- Execute somente se você já instalou a versão anterior do schema com pix_copy_paste.
USE astra_store;

SET @has_pix_column = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payments'
    AND COLUMN_NAME = 'pix_copy_paste'
);

SET @drop_pix_column_sql = IF(
  @has_pix_column > 0,
  'ALTER TABLE payments DROP COLUMN pix_copy_paste',
  'SELECT "A coluna pix_copy_paste já não existe" AS info'
);

PREPARE drop_pix_column_stmt FROM @drop_pix_column_sql;
EXECUTE drop_pix_column_stmt;
DEALLOCATE PREPARE drop_pix_column_stmt;
