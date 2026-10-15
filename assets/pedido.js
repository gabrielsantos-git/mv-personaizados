// Criação de pedido pelo servidor (função public.criar_pedido no Supabase).
// O navegador manda só O QUE o cliente escolheu — produto, variações,
// quantidade e arte. Preços, descontos, taxas e total são recalculados no
// servidor a partir do banco (supabase/pedidos_1_criar_pedido.sql).

import { variacoesDoItem } from './carrinho.js';

// Itens do carrinho -> formato esperado por criar_pedido.
// getArte(produtoId) devolve a arte escolhida pro produto (ou null).
export function montarItensPedido(itensCarrinho, getArte) {
    return itensCarrinho.map((item) => {
        const arte = item.categoria === 'personalizado' ? getArte(item.produtoId) : null;
        return {
            produto_id: item.produtoId,
            variacao_ids: variacoesDoItem(item),
            quantidade: item.quantidade,
            arte_tipo: arte?.tipo || null,
            arte_url: arte?.tipo === 'cliente' ? arte.arteUrl || null : null,
            arte_descricao: arte?.tipo === 'loja' ? arte.descricao || null : null
        };
    });
}

// Erro devolvido pelo servidor -> { mensagem, voltarAoCarrinho }.
export function interpretarErroPedido(erro) {
    const codigo = String(erro?.message || '');

    if (codigo === 'precos_divergentes') {
        return {
            mensagem: 'O valor de alguns itens mudou desde que foram adicionados ao carrinho. '
                + 'Remova e adicione de novo os produtos para ver o preço atual.',
            voltarAoCarrinho: false
        };
    }
    if (codigo === 'produto_indisponivel') {
        return { mensagem: 'Um dos produtos do carrinho não está mais disponível. Remova-o e tente de novo.', voltarAoCarrinho: false };
    }
    if (codigo === 'variacao_invalida' || codigo === 'item_invalido') {
        return { mensagem: 'Uma das opções escolhidas não existe mais. Remova o produto e adicione de novo.', voltarAoCarrinho: false };
    }
    if (codigo === 'quantidade_minima') {
        // detalhe vem do servidor como "Nome do produto|mínimo"
        const [produto, minimo] = String(erro?.details || '').split('|');
        const texto = produto && minimo
            ? `O produto "${produto}" tem pedido mínimo de ${minimo} unidades. Ajuste a quantidade no carrinho.`
            : 'Um dos produtos está abaixo da quantidade mínima. Ajuste a quantidade no carrinho.';
        return { mensagem: texto, voltarAoCarrinho: false };
    }
    if (codigo === 'quantidade_invalida') {
        return { mensagem: 'Há uma quantidade inválida no carrinho.', voltarAoCarrinho: true };
    }
    if (codigo === 'arte_incompleta') {
        return { mensagem: 'Falta escolher a arte de um produto personalizado.', voltarAoCarrinho: true };
    }
    if (codigo === 'pedido_vazio') {
        return { mensagem: 'Seu carrinho está vazio.', voltarAoCarrinho: true };
    }
    if (codigo === 'endereco_obrigatorio') {
        return { mensagem: 'Preencha o endereço de entrega.', voltarAoCarrinho: false };
    }
    if (codigo === 'nao_autenticado') {
        return { mensagem: 'Sua sessão expirou. Entre de novo para finalizar a compra.', voltarAoCarrinho: false };
    }
    return { mensagem: 'Não foi possível criar o pedido. Tente novamente.', voltarAoCarrinho: false };
}
