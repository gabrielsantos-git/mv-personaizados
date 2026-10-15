-- =============================================================================
-- Testes do criar_pedido e das permissões de pedidos (migrações 1 e 2).
--
-- SEGURO PARA RODAR NO BANCO REAL: tudo acontece numa única transação que
-- termina SEMPRE com um erro proposital ("RESULTADO_TESTES: ...") — o Postgres
-- desfaz tudo (produtos, promoções e pedidos de teste somem). O resultado vem
-- na própria mensagem de erro, em JSON.
--
-- Como rodar: SQL Editor do Supabase (ou MCP execute_sql), colar e executar.
-- Antes de aplicar as migrações, cole o conteúdo delas ANTES deste arquivo
-- no mesmo comando — assim elas também são testadas e desfeitas.
-- =============================================================================

do $testes$
declare
    r jsonb := '[]'::jsonb;
    v_cliente uuid;
    v_admin uuid;
    v_outro uuid := gen_random_uuid();
    pA uuid; pB uuid; pC uuid; pX uuid;
    vP uuid; vM uuid; vAzul uuid; vVerde uuid; vQP uuid; vQG uuid; vEstampa uuid; vOutro uuid;
    v_pedido uuid; v_total numeric; v_n int; v_status text; v_msg text; v_det text;
    v_estoque_antes int; v_estoque_depois int; v_venda uuid;
begin
    select id into v_cliente from public.profiles where coalesce(is_admin, false) = false limit 1;
    select id into v_admin   from public.profiles where is_admin = true limit 1;

    -- ---------------- dados de teste (somem no rollback) --------------------
    -- promoções reais ficam de fora do teste (desativadas só dentro da transação)
    update public.promocoes set rascunho = true where rascunho = false;

    insert into public.produtos (nome, categoria, status, preco, estoque, publico)
        values ('Teste A', 'papelaria', 'ativo', 100, 50, true) returning id into pA;
    insert into public.produtos (nome, categoria, status, preco, estoque, publico)
        values ('Teste B', 'informatica', 'ativo', 40, 50, true) returning id into pB;
    insert into public.produtos (nome, categoria, status, preco, estoque, publico)
        values ('Teste C', 'personalizado', 'ativo', 30, 50, true) returning id into pC;
    insert into public.produtos (nome, categoria, status, preco, estoque, publico)
        values ('Teste Inativo', 'papelaria', 'inativo', 10, 50, true) returning id into pX;

    -- A: tamanho com preço próprio (absoluto) + cor com acréscimo
    insert into public.variacoes_produto (produto_id, tipo, valor, preco_adicional, preco_modo, estilo_exibicao, created_at)
        values (pA, 'tamanho', 'P', 80, 'absoluto', 'radio', now() - interval '2 min') returning id into vP;
    insert into public.variacoes_produto (produto_id, tipo, valor, preco_adicional, preco_modo, estilo_exibicao, created_at)
        values (pA, 'tamanho', 'M', 90, 'absoluto', 'radio', now() - interval '2 min') returning id into vM;
    insert into public.variacoes_produto (produto_id, tipo, valor, preco_adicional, preco_modo, estilo_exibicao, created_at)
        values (pA, 'cor', 'azul', 5, 'adicional', 'radio', now() - interval '1 min') returning id into vAzul;
    insert into public.variacoes_produto (produto_id, tipo, valor, preco_adicional, preco_modo, estilo_exibicao, created_at)
        values (pA, 'cor', 'verde', 0, 'adicional', 'radio', now() - interval '1 min') returning id into vVerde;
    -- B: grupo por quantidade (P usa o preço do produto, G tem preço próprio) + estampa
    insert into public.variacoes_produto (produto_id, tipo, valor, preco_adicional, preco_modo, estilo_exibicao)
        values (pB, 'tamanho', 'P', 0, 'absoluto', 'quantidade') returning id into vQP;
    insert into public.variacoes_produto (produto_id, tipo, valor, preco_adicional, preco_modo, estilo_exibicao)
        values (pB, 'tamanho', 'G', 50, 'absoluto', 'quantidade') returning id into vQG;
    insert into public.variacoes_produto (produto_id, tipo, valor, preco_adicional, preco_modo, estilo_exibicao)
        values (pB, 'estampa', 'frente', 3, 'adicional', 'radio') returning id into vEstampa;
    insert into public.variacoes_produto (produto_id, tipo, valor, preco_adicional, preco_modo, estilo_exibicao)
        values (pB, 'cor', 'x', 0, 'adicional', 'radio') returning id into vOutro;

    -- promoção de 10% na categoria do produto A
    insert into public.promocoes (nome, tipo_desconto, valor, alvo, categoria, rascunho, data_inicio, data_fim)
        values ('Teste 10%', 'percentual', 10, 'categoria', 'papelaria', false, current_date - 1, current_date + 1);
    -- promoção em rascunho (não pode contar)
    insert into public.promocoes (nome, tipo_desconto, valor, alvo, categoria, rascunho, data_inicio, data_fim)
        values ('Teste rascunho', 'fixo', 99, 'categoria', 'papelaria', true, current_date - 1, current_date + 1);

    -- ======================= criar_pedido ===================================
    -- 1) sem login
    perform set_config('request.jwt.claims', '', true);
    begin
        perform public.criar_pedido(jsonb_build_array(jsonb_build_object('produto_id', pA, 'quantidade', 1)), 'Rua X', 'pix');
        r := r || jsonb_build_object('t', '01 sem login bloqueado', 'ok', false);
    exception when others then
        r := r || jsonb_build_object('t', '01 sem login bloqueado', 'ok', sqlerrm = 'nao_autenticado', 'msg', sqlerrm);
    end;

    -- daqui pra frente: cliente logado, com o papel real "authenticated"
    perform set_config('request.jwt.claims', json_build_object('sub', v_cliente, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';

    -- 2) produto simples com promoção 10%: 3 x 90 = 270
    select pedido_id, total into v_pedido, v_total from public.criar_pedido(
        jsonb_build_array(jsonb_build_object('produto_id', pA, 'quantidade', 3)), 'Rua X, 1', 'pix', null, 270);
    select status into v_status from public.pedidos where id = v_pedido;
    select count(*) into v_n from public.itens_pedido where pedido_id = v_pedido and preco_unitario = 90 and subtotal = 270 and nome_produto = 'Teste A';
    r := r || jsonb_build_object('t', '02 promo 10% (3x90=270)', 'ok', v_total = 270 and v_status = 'pendente' and v_n = 1, 'total', v_total);

    -- 3) preço próprio (80, sem promo) + acréscimo (5) = 85 x 2 = 170; nome com variações
    select pedido_id, total into v_pedido, v_total from public.criar_pedido(
        jsonb_build_array(jsonb_build_object('produto_id', pA, 'quantidade', 2, 'variacao_ids', jsonb_build_array(vAzul, vP))), 'Rua X', 'credito');
    select count(*) into v_n from public.itens_pedido where pedido_id = v_pedido and preco_unitario = 85
        and nome_produto = 'Teste A (Tamanho: P, Cor: azul)' and variacao_id = vP;
    r := r || jsonb_build_object('t', '03 absoluto+adicional (2x85=170)', 'ok', v_total = 170 and v_n = 1, 'total', v_total);

    -- 4) só acréscimo: 90 + 5 = 95
    select total into v_total from public.criar_pedido(
        jsonb_build_array(jsonb_build_object('produto_id', pA, 'quantidade', 1, 'variacao_ids', jsonb_build_array(vAzul))), 'Rua X', 'pix');
    r := r || jsonb_build_object('t', '04 promo+adicional (95)', 'ok', v_total = 95, 'total', v_total);

    -- 5) grupo por quantidade: P(40+3) x2 + G(50+3) x1 = 139
    select pedido_id, total into v_pedido, v_total from public.criar_pedido(jsonb_build_array(
        jsonb_build_object('produto_id', pB, 'quantidade', 2, 'variacao_ids', jsonb_build_array(vQP, vEstampa)),
        jsonb_build_object('produto_id', pB, 'quantidade', 1, 'variacao_ids', jsonb_build_array(vQG, vEstampa))
    ), 'Rua X', 'pix', null, 139);
    select count(*) into v_n from public.itens_pedido where pedido_id = v_pedido and variacao_id in (vQP, vQG);
    r := r || jsonb_build_object('t', '05 grupo quantidade (139)', 'ok', v_total = 139 and v_n = 2, 'total', v_total);

    -- 6) personalizado com arte da loja em 2 linhas: 30 + 60 + taxa 50 (uma vez) = 140
    select total into v_total from public.criar_pedido(jsonb_build_array(
        jsonb_build_object('produto_id', pC, 'quantidade', 1, 'arte_tipo', 'loja', 'arte_descricao', 'logo azul'),
        jsonb_build_object('produto_id', pC, 'quantidade', 2, 'arte_tipo', 'loja', 'arte_descricao', 'logo azul')
    ), 'Rua X', 'pix', null, 140);
    r := r || jsonb_build_object('t', '06 taxa arte uma vez por produto (140)', 'ok', v_total = 140, 'total', v_total);

    -- 7) arte do cliente sem taxa: 30
    select total into v_total from public.criar_pedido(jsonb_build_array(
        jsonb_build_object('produto_id', pC, 'quantidade', 1, 'arte_tipo', 'cliente', 'arte_url', 'https://x/arte.png')), 'Rua X', 'pix');
    r := r || jsonb_build_object('t', '07 arte do cliente sem taxa (30)', 'ok', v_total = 30, 'total', v_total);

    -- 8) personalizado sem arte
    begin
        perform public.criar_pedido(jsonb_build_array(jsonb_build_object('produto_id', pC, 'quantidade', 1)), 'Rua X', 'pix');
        r := r || jsonb_build_object('t', '08 personalizado sem arte', 'ok', false);
    exception when others then
        r := r || jsonb_build_object('t', '08 personalizado sem arte', 'ok', sqlerrm = 'arte_incompleta', 'msg', sqlerrm);
    end;

    -- 9) total adulterado: recusa e NÃO cria pedido
    select count(*) into v_n from public.pedidos where cliente_id = v_cliente;
    begin
        perform public.criar_pedido(jsonb_build_array(jsonb_build_object('produto_id', pA, 'quantidade', 3)), 'Rua X', 'pix', null, 0.01);
        r := r || jsonb_build_object('t', '09 total adulterado', 'ok', false);
    exception when others then
        get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
        r := r || jsonb_build_object('t', '09 total adulterado', 'ok',
            v_msg = 'precos_divergentes' and v_det = '270.00'
            and (select count(*) from public.pedidos where cliente_id = v_cliente) = v_n, 'msg', v_msg, 'detalhe', v_det);
    end;

    -- 10) variação de outro produto
    begin
        perform public.criar_pedido(jsonb_build_array(jsonb_build_object('produto_id', pA, 'quantidade', 1, 'variacao_ids', jsonb_build_array(vEstampa))), 'Rua X', 'pix');
        r := r || jsonb_build_object('t', '10 variacao de outro produto', 'ok', false);
    exception when others then
        r := r || jsonb_build_object('t', '10 variacao de outro produto', 'ok', sqlerrm = 'variacao_invalida', 'msg', sqlerrm);
    end;

    -- 11) duas variações do mesmo grupo
    begin
        perform public.criar_pedido(jsonb_build_array(jsonb_build_object('produto_id', pA, 'quantidade', 1, 'variacao_ids', jsonb_build_array(vP, vM))), 'Rua X', 'pix');
        r := r || jsonb_build_object('t', '11 duas do mesmo grupo', 'ok', false);
    exception when others then
        r := r || jsonb_build_object('t', '11 duas do mesmo grupo', 'ok', sqlerrm = 'variacao_invalida', 'msg', sqlerrm);
    end;

    -- 12) produto inativo
    begin
        perform public.criar_pedido(jsonb_build_array(jsonb_build_object('produto_id', pX, 'quantidade', 1)), 'Rua X', 'pix');
        r := r || jsonb_build_object('t', '12 produto inativo', 'ok', false);
    exception when others then
        r := r || jsonb_build_object('t', '12 produto inativo', 'ok', sqlerrm = 'produto_indisponivel', 'msg', sqlerrm);
    end;

    -- 13) quantidade inválida (0 e texto)
    begin
        perform public.criar_pedido(jsonb_build_array(jsonb_build_object('produto_id', pA, 'quantidade', 0)), 'Rua X', 'pix');
        r := r || jsonb_build_object('t', '13a quantidade 0', 'ok', false);
    exception when others then
        r := r || jsonb_build_object('t', '13a quantidade 0', 'ok', sqlerrm = 'quantidade_invalida', 'msg', sqlerrm);
    end;
    begin
        perform public.criar_pedido(jsonb_build_array(jsonb_build_object('produto_id', pA, 'quantidade', 'abc')), 'Rua X', 'pix');
        r := r || jsonb_build_object('t', '13b quantidade texto', 'ok', false);
    exception when others then
        r := r || jsonb_build_object('t', '13b quantidade texto', 'ok', sqlerrm = 'quantidade_invalida', 'msg', sqlerrm);
    end;

    -- 14) carrinho antigo (só "variacao_id") continua aceito
    select total into v_total from public.criar_pedido(
        jsonb_build_array(jsonb_build_object('produto_id', pA, 'quantidade', 1, 'variacao_id', vVerde)), 'Rua X', 'pix');
    r := r || jsonb_build_object('t', '14 carrinho antigo (variacao_id)', 'ok', v_total = 90, 'total', v_total);

    -- 15) pedido vazio e endereço vazio
    begin
        perform public.criar_pedido('[]'::jsonb, 'Rua X', 'pix');
        r := r || jsonb_build_object('t', '15a pedido vazio', 'ok', false);
    exception when others then
        r := r || jsonb_build_object('t', '15a pedido vazio', 'ok', sqlerrm = 'pedido_vazio', 'msg', sqlerrm);
    end;
    begin
        perform public.criar_pedido(jsonb_build_array(jsonb_build_object('produto_id', pA, 'quantidade', 1)), '  ', 'pix');
        r := r || jsonb_build_object('t', '15b endereco vazio', 'ok', false);
    exception when others then
        r := r || jsonb_build_object('t', '15b endereco vazio', 'ok', sqlerrm = 'endereco_obrigatorio', 'msg', sqlerrm);
    end;

    -- 15c-15f) quantidade mínima (produto com pedido mínimo de 10)
    execute 'reset role';
    update public.produtos set quantidade_minima = 10 where id = pB;
    execute 'set local role authenticated';
    begin
        perform public.criar_pedido(jsonb_build_array(
            jsonb_build_object('produto_id', pB, 'quantidade', 4, 'variacao_ids', jsonb_build_array(vQP)),
            jsonb_build_object('produto_id', pB, 'quantidade', 5, 'variacao_ids', jsonb_build_array(vQG))), 'Rua X', 'pix');
        r := r || jsonb_build_object('t', '15c minimo: 4+5=9 recusado', 'ok', false);
    exception when others then
        get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail;
        r := r || jsonb_build_object('t', '15c minimo: 4+5=9 recusado', 'ok', v_msg = 'quantidade_minima' and v_det = 'Teste B|10', 'msg', v_msg, 'detalhe', v_det);
    end;
    begin
        perform public.criar_pedido(jsonb_build_array(jsonb_build_object('produto_id', pB, 'quantidade', 1)), 'Rua X', 'pix');
        r := r || jsonb_build_object('t', '15d minimo: 1 unidade direto na funcao recusado', 'ok', false);
    exception when others then
        r := r || jsonb_build_object('t', '15d minimo: 1 unidade direto na funcao recusado', 'ok', sqlerrm = 'quantidade_minima', 'msg', sqlerrm);
    end;
    select total into v_total from public.criar_pedido(jsonb_build_array(
        jsonb_build_object('produto_id', pB, 'quantidade', 5, 'variacao_ids', jsonb_build_array(vQP)),
        jsonb_build_object('produto_id', pB, 'quantidade', 5, 'variacao_ids', jsonb_build_array(vQG))), 'Rua X', 'pix');
    r := r || jsonb_build_object('t', '15e minimo: 5+5=10 aceito (5x40 + 5x50 = 450)', 'ok', v_total = 450, 'total', v_total);
    select total into v_total from public.criar_pedido(jsonb_build_array(jsonb_build_object('produto_id', pB, 'quantidade', 12)), 'Rua X', 'pix');
    r := r || jsonb_build_object('t', '15f minimo: 12 numa linha aceito (480)', 'ok', v_total = 480, 'total', v_total);
    execute 'reset role';
    update public.produtos set quantidade_minima = 1 where id = pB;
    execute 'set local role authenticated';

    -- 16) funções internas não podem ser chamadas pelo cliente
    begin
        perform public.preco_com_promocao(pA);
        r := r || jsonb_build_object('t', '16 funcao interna protegida', 'ok', false);
    exception when insufficient_privilege then
        r := r || jsonb_build_object('t', '16 funcao interna protegida', 'ok', true);
    end;

    -- ======================= permissões (RLS) ================================
    -- pedido do cliente criado pelo caminho certo, pra testar alterações
    select pedido_id into v_pedido from public.criar_pedido(
        jsonb_build_array(jsonb_build_object('produto_id', pA, 'quantidade', 1)), 'Rua X', 'dinheiro');

    -- 17) insert direto em pedidos (total à escolha do cliente)
    begin
        insert into public.pedidos (cliente_id, status, total, forma_pagamento, endereco_entrega)
            values (v_cliente, 'entregue', 0.01, 'pix', 'Rua X');
        r := r || jsonb_build_object('t', '17 insert direto em pedidos bloqueado', 'ok', false);
    exception when insufficient_privilege then
        r := r || jsonb_build_object('t', '17 insert direto em pedidos bloqueado', 'ok', true);
    end;

    -- 18) insert direto em itens_pedido
    begin
        insert into public.itens_pedido (pedido_id, nome_produto, preco_unitario, quantidade, subtotal)
            values (v_pedido, 'brinde', 0, 1, 0);
        r := r || jsonb_build_object('t', '18 insert direto em itens bloqueado', 'ok', false);
    exception when insufficient_privilege then
        r := r || jsonb_build_object('t', '18 insert direto em itens bloqueado', 'ok', true);
    end;

    -- 19) cliente tenta mudar status/total do próprio pedido: nada muda
    update public.pedidos set status = 'entregue', total = 0.01 where id = v_pedido;
    get diagnostics v_n = row_count;
    execute 'reset role';
    select status, total into v_status, v_total from public.pedidos where id = v_pedido;
    execute 'set local role authenticated';
    r := r || jsonb_build_object('t', '19 cliente nao altera status/total', 'ok', v_n = 0 and v_status = 'pendente' and v_total = 90,
                                 'linhas_afetadas', v_n, 'status', v_status, 'total', v_total);

    -- 20) cliente continua vendo o próprio pedido e os itens
    select count(*) into v_n from public.pedidos p join public.itens_pedido i on i.pedido_id = p.id where p.id = v_pedido;
    r := r || jsonb_build_object('t', '20 cliente ve o proprio pedido', 'ok', v_n = 1);

    -- 21) outro cliente não vê esse pedido
    perform set_config('request.jwt.claims', json_build_object('sub', v_outro, 'role', 'authenticated')::text, true);
    select count(*) into v_n from public.pedidos where id = v_pedido;
    r := r || jsonb_build_object('t', '21 outro cliente nao ve', 'ok', v_n = 0);

    -- 22) admin altera status (painel de pedidos) e exclui
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    update public.pedidos set status = 'em_producao', codigo_rastreio = 'BR123' where id = v_pedido;
    get diagnostics v_n = row_count;
    r := r || jsonb_build_object('t', '22 admin altera status', 'ok', v_n = 1);

    -- 23) venda de balcão (admin) continua baixando o estoque
    select estoque into v_estoque_antes from public.produtos where id = pA;
    insert into public.vendas (cliente_nome, forma_pagamento, total, criado_por) values ('Balcão', 'dinheiro', 180, v_admin) returning id into v_venda;
    insert into public.itens_venda (venda_id, produto_id, nome_produto, preco_unitario, quantidade, subtotal) values (v_venda, pA, 'Teste A', 90, 2, 180);
    select estoque into v_estoque_depois from public.produtos where id = pA;
    r := r || jsonb_build_object('t', '23 balcao baixa estoque (50->48)', 'ok', v_estoque_antes = 50 and v_estoque_depois = 48);

    -- 24) pedido online continua NÃO mexendo no estoque (comportamento atual)
    select estoque into v_estoque_antes from public.produtos where id = pC;
    r := r || jsonb_build_object('t', '24 pedido online nao mexe no estoque', 'ok', v_estoque_antes = 50);

    -- 25) admin exclui pedido
    delete from public.pedidos where id = v_pedido;
    get diagnostics v_n = row_count;
    r := r || jsonb_build_object('t', '25 admin exclui pedido', 'ok', v_n = 1);

    execute 'reset role';
    raise exception 'RESULTADO_TESTES: %', jsonb_build_object(
        'aprovados', (select count(*) from jsonb_array_elements(r) e where (e->>'ok')::boolean),
        'total', jsonb_array_length(r),
        'falhas', (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(r) e where not (e->>'ok')::boolean),
        'detalhes', r);
end
$testes$;
