// Testes do lado do navegador da criação de pedido (assets/pedido.js) e da
// regra de juntar itens iguais no carrinho (assets/carrinho.js).
// A precificação em si é testada no banco: supabase/testes_pedidos.sql.
// Rodar com:  node --test tests/pedido.test.mjs

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// carrinho.js usa localStorage e document — simulados aqui.
const armazenamento = new Map();
globalThis.localStorage = {
    getItem: (k) => (armazenamento.has(k) ? armazenamento.get(k) : null),
    setItem: (k, v) => armazenamento.set(k, String(v)),
    removeItem: (k) => armazenamento.delete(k)
};
globalThis.document = { addEventListener() {}, querySelectorAll: () => [] };

const { adicionarItem, getCarrinho, chaveDoItem, variacoesDoItem } = await import('../assets/carrinho.js');
const { montarItensPedido, interpretarErroPedido } = await import('../assets/pedido.js');

describe('carrinho: juntar só itens realmente iguais', () => {
    beforeEach(() => armazenamento.clear());

    test('mesma variação principal mas cor diferente NÃO junta', () => {
        adicionarItem({ produtoId: 'p1', variacaoId: 'tamP', variacaoIds: ['tamP', 'azul'], preco: 85, quantidade: 1 });
        adicionarItem({ produtoId: 'p1', variacaoId: 'tamP', variacaoIds: ['tamP', 'verde'], preco: 80, quantidade: 2 });
        assert.equal(getCarrinho().length, 2);
    });

    test('mesmas variações (em qualquer ordem) somam a quantidade', () => {
        adicionarItem({ produtoId: 'p1', variacaoId: 'tamP', variacaoIds: ['tamP', 'azul'], preco: 85, quantidade: 1 });
        adicionarItem({ produtoId: 'p1', variacaoId: 'tamP', variacaoIds: ['azul', 'tamP'], preco: 85, quantidade: 2 });
        const carrinho = getCarrinho();
        assert.equal(carrinho.length, 1);
        assert.equal(carrinho[0].quantidade, 3);
    });

    test('produto sem variação (botão "Adicionar" das vitrines)', () => {
        adicionarItem({ produtoId: 'p2', variacaoId: null, preco: 10, quantidade: 1 });
        adicionarItem({ produtoId: 'p2', variacaoId: null, preco: 10, quantidade: 1 });
        assert.equal(getCarrinho().length, 1);
        assert.equal(getCarrinho()[0].quantidade, 2);
    });

    test('item antigo (só variacaoId) continua reconhecido', () => {
        assert.deepEqual(variacoesDoItem({ produtoId: 'p1', variacaoId: 'v1' }), ['v1']);
        assert.deepEqual(variacoesDoItem({ produtoId: 'p1', variacaoId: null }), []);
        assert.equal(chaveDoItem({ produtoId: 'p1', variacaoId: 'v1' }), chaveDoItem({ produtoId: 'p1', variacaoIds: ['v1'] }));
    });
});

describe('montarItensPedido: o navegador manda só o que foi escolhido', () => {
    const artes = {
        pers: { tipo: 'loja', descricao: 'logo azul' },
        pers2: { tipo: 'cliente', arteUrl: 'https://x/arte.png' },
        comum: { tipo: 'loja', descricao: 'não deve ir' }
    };
    const getArte = (id) => artes[id] || null;

    test('não envia preço, subtotal nem total — só produto, variações, quantidade e arte', () => {
        const [item] = montarItensPedido([{ produtoId: 'comum', variacaoIds: ['a', 'b'], preco: 0.01, quantidade: 3, categoria: 'papelaria' }], getArte);
        assert.deepEqual(Object.keys(item).sort(), ['arte_descricao', 'arte_tipo', 'arte_url', 'produto_id', 'quantidade', 'variacao_ids']);
        assert.deepEqual(item.variacao_ids, ['a', 'b']);
        assert.equal(item.quantidade, 3);
    });

    test('arte só vai para produto personalizado', () => {
        const [comum] = montarItensPedido([{ produtoId: 'comum', quantidade: 1, categoria: 'papelaria' }], getArte);
        assert.equal(comum.arte_tipo, null);
        const [loja, cliente] = montarItensPedido([
            { produtoId: 'pers', quantidade: 1, categoria: 'personalizado' },
            { produtoId: 'pers2', quantidade: 1, categoria: 'personalizado' }
        ], getArte);
        assert.deepEqual([loja.arte_tipo, loja.arte_descricao, loja.arte_url], ['loja', 'logo azul', null]);
        assert.deepEqual([cliente.arte_tipo, cliente.arte_url, cliente.arte_descricao], ['cliente', 'https://x/arte.png', null]);
    });

    test('item antigo do carrinho manda a variação principal', () => {
        const [item] = montarItensPedido([{ produtoId: 'comum', variacaoId: 'v1', quantidade: 1 }], getArte);
        assert.deepEqual(item.variacao_ids, ['v1']);
    });
});

describe('interpretarErroPedido: mensagens claras', () => {
    test('preços divergentes', () => assert.match(interpretarErroPedido({ message: 'precos_divergentes' }).mensagem, /valor de alguns itens mudou/));
    test('produto indisponível', () => assert.match(interpretarErroPedido({ message: 'produto_indisponivel' }).mensagem, /não está mais disponível/));
    test('quantidade mínima mostra produto e mínimo', () => {
        const r = interpretarErroPedido({ message: 'quantidade_minima', details: 'Plaquinha de Festa Personalizada|10' });
        assert.match(r.mensagem, /"Plaquinha de Festa Personalizada" tem pedido mínimo de 10 unidades/);
        assert.match(interpretarErroPedido({ message: 'quantidade_minima' }).mensagem, /quantidade mínima/);
    });
    test('arte incompleta volta ao carrinho', () => assert.equal(interpretarErroPedido({ message: 'arte_incompleta' }).voltarAoCarrinho, true));
    test('sessão expirada', () => assert.match(interpretarErroPedido({ message: 'nao_autenticado' }).mensagem, /sessão/));
    test('erro desconhecido / rede', () => {
        assert.match(interpretarErroPedido({ message: 'TypeError: Failed to fetch' }).mensagem, /Não foi possível criar o pedido/);
        assert.match(interpretarErroPedido(null).mensagem, /Não foi possível criar o pedido/);
    });
});
