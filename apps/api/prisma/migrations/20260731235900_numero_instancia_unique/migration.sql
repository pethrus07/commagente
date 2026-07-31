-- Unicidade da instância Evolution: o webhook resolve o NÚMERO pela instância
-- (acharNumeroPorInstancia). Sem unique, uma colisão de nome de instância entre
-- tenants poderia rotear inbound/contatos/missão de suporte pro tenant errado
-- (vazamento cross-tenant). Constraint fecha isso na raiz. [P2-5]
CREATE UNIQUE INDEX "numeros_whatsapp_instancia_evolution_key" ON "numeros_whatsapp"("instancia_evolution");
