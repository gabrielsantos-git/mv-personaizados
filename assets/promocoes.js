// Busca as promoções ativas de desconto em produto/categoria e calcula o
// preço final de cada produto. Cupons (código digitado no checkout) não
// são tratados aqui — isso fica pra quando o checkout ganhar esse campo.

import { supabase } from './supabaseClient.js';

export async function carregarPromocoesAtivas() {
    const hoje = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
        .from('promocoes')
        .select('id, tipo_desconto, valor, alvo, produto_id, categoria')
        .in('alvo', ['produto', 'categoria'])
        .eq('rascunho', false)
        .lte('data_inicio', hoje)
        .gte('data_fim', hoje);

    if (error || !data) return [];
    return data;
}

function valorDoDesconto(preco, promocao) {
    return promocao.tipo_desconto === 'percentual'
        ? Number(preco) * (Number(promocao.valor) / 100)
        : Number(promocao.valor);
}

// Entre as promoções que valem pro produto (por id específico ou pela
// categoria dele), pega a que dá o maior desconto em reais.
function melhorPromocaoDoProduto(produto, promocoes) {
    const aplicaveis = promocoes.filter((p) =>
        (p.alvo === 'produto' && p.produto_id === produto.id) ||
        (p.alvo === 'categoria' && p.categoria === produto.categoria)
    );

    if (aplicaveis.length === 0) return null;

    return aplicaveis.reduce((melhor, atual) => {
        if (!melhor) return atual;
        return valorDoDesconto(produto.preco, atual) > valorDoDesconto(produto.preco, melhor) ? atual : melhor;
    }, null);
}

// Retorna { precoFinal, precoOriginal, percentualOff, promocao }.
// precoOriginal e promocao vêm null quando o produto não tem desconto.
export function calcularPrecoComDesconto(produto, promocoes) {
    const precoOriginal = Number(produto.preco);
    const promocao = melhorPromocaoDoProduto(produto, promocoes);

    if (!promocao) {
        return { precoFinal: precoOriginal, precoOriginal: null, percentualOff: 0, promocao: null };
    }

    const desconto = valorDoDesconto(precoOriginal, promocao);
    const precoFinal = Math.max(0, precoOriginal - desconto);
    const percentualOff = precoOriginal > 0 ? Math.round((desconto / precoOriginal) * 100) : 0;

    return { precoFinal, precoOriginal, percentualOff, promocao };
}

// Monta o HTML do bloco de preço (com "de/por" quando tem desconto ativo).
export function blocoPrecoHtml(produto, promocoes, formatarPreco) {
    const { precoFinal, precoOriginal, percentualOff } = calcularPrecoComDesconto(produto, promocoes);

    if (!precoOriginal) {
        return `<h4 class="preco">${formatarPreco(precoFinal)}</h4>`;
    }

    return `
        <div class="blocoPreco">
            <span class="precoAntigo">${formatarPreco(precoOriginal)}</span>
            <h4 class="preco comDesconto">${formatarPreco(precoFinal)}<span class="badgeDesconto">-${percentualOff}%</span></h4>
        </div>
    `;
}
