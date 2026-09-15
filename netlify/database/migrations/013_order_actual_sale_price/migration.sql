-- What an order actually sold for, which is not always what it was listed at:
-- a discount agreed over WhatsApp, a rounded-down cash payment at the door.
--
-- Stored in PAISE as an integer, not rupees as a numeric, so two decimal
-- places are exact and no amount can drift through floating-point rounding.
-- Nullable because every order placed before this column existed has no
-- recorded figure, and inventing one would be worse than leaving it blank.
ALTER TABLE "orders" ADD COLUMN "actual_sale_price_paise" integer;
