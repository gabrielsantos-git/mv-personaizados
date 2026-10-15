-- =============================================================================
-- MIGRAÇÃO 1 de 2 — Pedido criado e precificado NO SERVIDOR.
--
-- Só ADICIONA funções; não altera tabelas, políticas nem dados existentes.
-- Pode ser aplicada com o site atual no ar: o checkout antigo continua
-- funcionando até a migração 2 (que remove o insert direto do cliente).
--
-- public.criar_pedido(...) recebe só O QUE o cliente escolheu (produto,
-- variações, quantidade, arte) e recalcula TODOS os valores a partir do
-- banco, com as mesmas regras que o site usa hoje:
--
--   preço com promoção (assets/promocoes.js)
--     = preço do produto - o MAIOR desconto entre as promoções ativas do
--       produto ou da categoria (percentual ou valor fixo), mínimo 0;
--       promoção ativa = alvo produto/categoria, não rascunho e com a data
--       de hoje (UTC) entre data_inicio e data_fim.
--
--   preço unitário do item (produto.html)
--     - variação de grupo "quantidade" (ex.: tamanhos P/M/G com contador):
--         (preco_adicional da variação, se > 0, senão o preço com promoção)
--         + soma dos acréscimos das outras variações escolhidas;
--     - sem grupo de quantidade:
--         (preço da variação "absoluto" escolhida, se houver, senão o preço
--          com promoção) + soma dos acréscimos ("adicional") escolhidos.
--
--   taxa de arte (assets/arte.js, TAXA_ARTE_LOJA = 50)
--     R$ 50 uma vez por produto da categoria "personalizado" cuja arte
--     será criada pela loja.
--
--   total = soma(preço unitário × quantidade) + taxas de arte, arredondado
--           em centavos.
--
--   quantidade mínima (produtos.quantidade_minima)
--     a soma das quantidades de cada produto no pedido precisa ser >= o
--     mínimo dele (erro quantidade_minima, detalhe "Nome|mínimo").
--
-- Se o cliente informar o total que viu na tela (p_total_esperado) e ele
-- não bater com o do servidor, o pedido NÃO é criado (erro
-- precos_divergentes) — assim ninguém paga um valor diferente do exibido.
-- O pedido e os itens são gravados na mesma transação (tudo ou nada).
-- =============================================================================

-- Mantenha igual a TAXA_ARTE_LOJA de assets/arte.js.
create or replace function public.taxa_arte_loja()
returns numeric
language sql
immutable
set search_path = ''
as $$ select 50::numeric $$;

-- Preço do produto com a melhor promoção ativa (regra de assets/promocoes.js).
create or replace function public.preco_com_promocao(p_produto_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
    select greatest(0, p.preco - coalesce((
        select max(case when pr.tipo_desconto = 'percentual'
                        then p.preco * (pr.valor / 100)
                        else pr.valor end)
        from public.promocoes pr
        where pr.alvo in ('produto', 'categoria')
          and pr.rascunho = false
          and pr.data_inicio <= (now() at time zone 'utc')::date
          and pr.data_fim    >= (now() at time zone 'utc')::date
          and ((pr.alvo = 'produto' and pr.produto_id = p.id)
            or (pr.alvo = 'categoria' and pr.categoria = p.categoria))
    ), 0))
    from public.produtos p
    where p.id = p_produto_id
$$;

create or replace function public.criar_pedido(
    p_itens jsonb,
    p_endereco_entrega text,
    p_forma_pagamento text,
    p_observacoes text default null,
    p_total_esperado numeric default null
)
returns table (pedido_id uuid, total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_uid uuid := auth.uid();
    v_item jsonb;
    v_ordem int;
    v_produto record;
    v_ids uuid[];
    v_qtd int;
    v_preco_promo numeric;
    v_qtd_var record;
    v_absoluto numeric;
    v_qtd_absolutos int;
    v_adicional numeric;
    v_unit numeric;
    v_nome text;
    v_partes text;
    v_principal uuid;
    v_arte_tipo text;
    v_arte_url text;
    v_arte_desc text;
    v_soma numeric := 0;
    v_total numeric;
    v_pedido uuid;
    v_linhas jsonb := '[]'::jsonb;
    v_produtos_arte_loja uuid[] := '{}';
    v_qtd_por_produto jsonb := '{}'::jsonb;
    v_minimo record;
begin
    if v_uid is null then
        raise exception 'nao_autenticado' using errcode = '42501';
    end if;

    if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
        raise exception 'pedido_vazio' using errcode = 'P0001';
    end if;
    if jsonb_array_length(p_itens) > 200 then
        raise exception 'pedido_grande_demais' using errcode = 'P0001';
    end if;
    if coalesce(btrim(p_endereco_entrega), '') = '' then
        raise exception 'endereco_obrigatorio' using errcode = 'P0001';
    end if;

    for v_item, v_ordem in select e, o from jsonb_array_elements(p_itens) with ordinality as t(e, o) loop
        -- ---- produto ----------------------------------------------------
        begin
            select id, nome, categoria, preco, quantidade_minima into v_produto
            from public.produtos
            where id = (v_item->>'produto_id')::uuid
              and status = 'ativo' and publico = true;
        exception when invalid_text_representation then
            raise exception 'item_invalido' using errcode = 'P0001', detail = 'item ' || v_ordem;
        end;
        if v_produto.id is null then
            raise exception 'produto_indisponivel' using errcode = 'P0001', detail = 'item ' || v_ordem;
        end if;

        -- ---- quantidade -------------------------------------------------
        begin
            v_qtd := (v_item->>'quantidade')::int;
        exception when others then
            v_qtd := null;
        end;
        if v_qtd is null or v_qtd < 1 or v_qtd > 100000 then
            raise exception 'quantidade_invalida' using errcode = 'P0001', detail = 'item ' || v_ordem;
        end if;

        -- ---- variações escolhidas (todas do mesmo produto) --------------
        begin
            select coalesce(array_agg(distinct x::uuid), '{}') into v_ids
            from jsonb_array_elements_text(
                case when jsonb_typeof(v_item->'variacao_ids') = 'array' then v_item->'variacao_ids'
                     when coalesce(v_item->>'variacao_id', '') <> '' then jsonb_build_array(v_item->>'variacao_id')
                     else '[]'::jsonb end
            ) as x;
        exception when invalid_text_representation then
            raise exception 'variacao_invalida' using errcode = 'P0001', detail = 'item ' || v_ordem;
        end;

        if (select count(*) from public.variacoes_produto v
             where v.id = any(v_ids) and v.produto_id = v_produto.id) <> coalesce(array_length(v_ids, 1), 0) then
            raise exception 'variacao_invalida' using errcode = 'P0001', detail = 'item ' || v_ordem;
        end if;

        -- no máximo 1 variação por grupo (tipo) e 1 de grupo "quantidade"
        if exists (select 1 from public.variacoes_produto v where v.id = any(v_ids)
                   group by v.tipo having count(*) > 1)
           or (select count(*) from public.variacoes_produto v
               where v.id = any(v_ids) and v.estilo_exibicao = 'quantidade') > 1 then
            raise exception 'variacao_invalida' using errcode = 'P0001', detail = 'item ' || v_ordem;
        end if;

        -- ---- preço (mesma regra do produto.html) ------------------------
        v_preco_promo := public.preco_com_promocao(v_produto.id);

        select coalesce(sum(coalesce(v.preco_adicional, 0)), 0) into v_adicional
        from public.variacoes_produto v
        where v.id = any(v_ids)
          and coalesce(v.estilo_exibicao, '') <> 'quantidade'
          and coalesce(v.preco_modo, 'adicional') <> 'absoluto';

        select v.id, v.preco_adicional into v_qtd_var
        from public.variacoes_produto v
        where v.id = any(v_ids) and v.estilo_exibicao = 'quantidade';

        if v_qtd_var.id is not null then
            v_unit := (case when coalesce(v_qtd_var.preco_adicional, 0) > 0
                            then v_qtd_var.preco_adicional else v_preco_promo end) + v_adicional;
            v_principal := v_qtd_var.id;
        else
            select count(*), max(coalesce(v.preco_adicional, 0)) into v_qtd_absolutos, v_absoluto
            from public.variacoes_produto v
            where v.id = any(v_ids)
              and coalesce(v.estilo_exibicao, '') <> 'quantidade'
              and v.preco_modo = 'absoluto';
            if v_qtd_absolutos > 1 then
                -- o site não permite escolher dois "preço próprio" ao mesmo tempo
                raise exception 'variacao_invalida' using errcode = 'P0001', detail = 'item ' || v_ordem;
            end if;
            v_unit := (case when v_qtd_absolutos = 1 then v_absoluto else v_preco_promo end) + v_adicional;
            select v.id into v_principal from public.variacoes_produto v
            where v.id = any(v_ids) order by v.created_at, v.id limit 1;
        end if;

        -- ---- nome exibido: "Produto (Tipo: valor, ...)" -----------------
        select string_agg(
                   upper(left(replace(v.tipo, '-', ' '), 1)) || substr(replace(v.tipo, '-', ' '), 2) || ': ' || v.valor,
                   ', ' order by (v.estilo_exibicao = 'quantidade'), v.created_at, v.id)
          into v_partes
        from public.variacoes_produto v where v.id = any(v_ids);
        v_nome := v_produto.nome || coalesce(' (' || v_partes || ')', '');

        -- ---- arte (só produtos "personalizado") -------------------------
        v_arte_tipo := null; v_arte_url := null; v_arte_desc := null;
        if v_produto.categoria = 'personalizado' then
            v_arte_tipo := v_item->>'arte_tipo';
            if v_arte_tipo = 'cliente' and coalesce(btrim(v_item->>'arte_url'), '') <> '' then
                v_arte_url := v_item->>'arte_url';
            elsif v_arte_tipo = 'loja' and coalesce(btrim(v_item->>'arte_descricao'), '') <> '' then
                v_arte_desc := v_item->>'arte_descricao';
                if not v_produto.id = any(v_produtos_arte_loja) then
                    v_produtos_arte_loja := v_produtos_arte_loja || v_produto.id;
                end if;
            else
                raise exception 'arte_incompleta' using errcode = 'P0001', detail = 'item ' || v_ordem;
            end if;
        end if;

        v_soma := v_soma + v_unit * v_qtd;
        v_qtd_por_produto := jsonb_set(v_qtd_por_produto, array[v_produto.id::text],
            to_jsonb(coalesce((v_qtd_por_produto->>v_produto.id::text)::int, 0) + v_qtd));
        v_linhas := v_linhas || jsonb_build_object(
            'produto_id', v_produto.id, 'variacao_id', v_principal, 'nome', v_nome,
            'preco', v_unit, 'quantidade', v_qtd,
            'arte_tipo', v_arte_tipo, 'arte_url', v_arte_url, 'arte_descricao', v_arte_desc);
    end loop;

    -- ---- quantidade mínima por produto --------------------------------
    -- Soma todas as linhas do mesmo produto (ex.: 5 de uma cor + 5 de outra
    -- = 10). Antes isso só era conferido na página do produto, e dava pra
    -- contornar pelo carrinho, pelo botão "Adicionar" das vitrines ou
    -- chamando esta função direto.
    for v_minimo in
        select p.nome, p.quantidade_minima, (q.value)::int as pedida
        from jsonb_each_text(v_qtd_por_produto) as q
        join public.produtos p on p.id = q.key::uuid
        where (q.value)::int < coalesce(p.quantidade_minima, 1)
        limit 1
    loop
        raise exception 'quantidade_minima' using errcode = 'P0001',
            detail = v_minimo.nome || '|' || v_minimo.quantidade_minima;
    end loop;

    v_total := round(v_soma + coalesce(array_length(v_produtos_arte_loja, 1), 0) * public.taxa_arte_loja(), 2);

    if p_total_esperado is not null and abs(round(p_total_esperado, 2) - v_total) > 0.01 then
        raise exception 'precos_divergentes' using errcode = 'P0001', detail = v_total::text;
    end if;

    insert into public.pedidos (cliente_id, status, total, forma_pagamento, endereco_entrega, observacoes)
    values (v_uid, 'pendente', v_total, p_forma_pagamento, btrim(p_endereco_entrega), nullif(btrim(p_observacoes), ''))
    returning id into v_pedido;

    insert into public.itens_pedido (pedido_id, produto_id, variacao_id, nome_produto, preco_unitario,
                                     quantidade, subtotal, arte_tipo, arte_url, arte_descricao)
    select v_pedido,
           (l->>'produto_id')::uuid,
           nullif(l->>'variacao_id', '')::uuid,
           l->>'nome',
           (l->>'preco')::numeric,
           (l->>'quantidade')::int,
           (l->>'preco')::numeric * (l->>'quantidade')::int,
           l->>'arte_tipo', l->>'arte_url', l->>'arte_descricao'
    from jsonb_array_elements(v_linhas) as l;

    return query select v_pedido, v_total;
end;
$$;

-- Só quem está logado chama criar_pedido; as funções auxiliares ficam
-- internas (chamadas apenas de dentro de criar_pedido).
revoke all on function public.criar_pedido(jsonb, text, text, text, numeric) from public, anon;
grant execute on function public.criar_pedido(jsonb, text, text, text, numeric) to authenticated;
revoke all on function public.preco_com_promocao(uuid) from public, anon, authenticated;
revoke all on function public.taxa_arte_loja() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- ROLLBACK (não mexe em dados):
--   drop function if exists public.criar_pedido(jsonb, text, text, text, numeric);
--   drop function if exists public.preco_com_promocao(uuid);
--   drop function if exists public.taxa_arte_loja();
-- ---------------------------------------------------------------------------
