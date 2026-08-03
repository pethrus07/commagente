-- Apelido/nome amigável do número (ex.: "Comercial", "João", "Vendas SP").
-- Identificação principal na UI; o telefone segue como info complementar. [parceiro Item 2]
ALTER TABLE "numeros_whatsapp" ADD COLUMN "apelido" TEXT;
