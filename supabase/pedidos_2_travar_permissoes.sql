-- =============================================================================
-- MIGRAÇÃO 2 de 2 — Cliente não grava nem altera pedidos diretamente.
--
-- APLICAR SÓ DEPOIS que o checkout novo (que usa public.criar_pedido, da
-- migração 1) estiver publicado — senão o checkout antigo, que ainda faz
-- insert direto, para de funcionar.
--
-- Não altera nenhum dado: só troca políticas de acesso (RLS).
--
-- Antes:
--   pedidos      INSERT  cliente cria pedido próprio com QUALQUER total/status
--   pedidos      UPDATE  cliente altera QUALQUER coluna do próprio pedido
--                        (status, total, forma de pagamento...)
--   itens_pedido INSERT  cliente cria itens com QUALQUER preço
-- Depois:
--   pedidos      INSERT  só pela função criar_pedido (servidor calcula tudo)
--   pedidos      UPDATE  só admin (painel de pedidos: status, previsão, rastreio)
--   itens_pedido INSERT  só pela função criar_pedido (ou admin)
--
-- Continuam iguais: cliente VÊ os próprios pedidos/itens; admin vê, altera
-- e exclui; vendas de balcão (vendas/itens_venda) e a baixa de estoque.
-- =============================================================================

drop policy if exists "Clientes criam os proprios pedidos" on public.pedidos;
drop policy if exists "Clientes atualizam os proprios pedidos" on public.pedidos;
drop policy if exists "Clientes criam itens dos proprios pedidos" on public.itens_pedido;

create policy "Admins atualizam pedidos" on public.pedidos
    for update
    using (public.is_admin())
    with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- ROLLBACK (recria exatamente as políticas anteriores; não mexe em dados):
--
--   drop policy if exists "Admins atualizam pedidos" on public.pedidos;
--   create policy "Clientes criam os proprios pedidos" on public.pedidos
--       for insert with check (auth.uid() = cliente_id);
--   create policy "Clientes atualizam os proprios pedidos" on public.pedidos
--       for update using ((auth.uid() = cliente_id) or public.is_admin());
--   create policy "Clientes criam itens dos proprios pedidos" on public.itens_pedido
--       for insert with check (exists (select 1 from public.pedidos p
--           where p.id = itens_pedido.pedido_id and p.cliente_id = auth.uid()));
-- ---------------------------------------------------------------------------
