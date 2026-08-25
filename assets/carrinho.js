// Carrinho de compras do cliente. Guardado no localStorage do navegador
// (não precisa de login pra adicionar itens — só na hora de fechar o pedido).
// Cada item guarda os dados já prontos pra exibir, então a página do
// carrinho não precisa buscar de novo no banco.

const CHAVE_CARRINHO = 'mv_carrinho';

export function getCarrinho() {
    try {
        const bruto = localStorage.getItem(CHAVE_CARRINHO);
        const itens = bruto ? JSON.parse(bruto) : [];
        return Array.isArray(itens) ? itens : [];
    } catch {
        return [];
    }
}

function salvarCarrinho(itens) {
    localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(itens));
    atualizarBadgeCarrinho();
}

// item: { produtoId, variacaoId, nome, preco, quantidade, imagem }
export function adicionarItem(item) {
    const itens = getCarrinho();
    const existente = itens.find((i) => i.produtoId === item.produtoId && i.variacaoId === item.variacaoId);

    if (existente) {
        existente.quantidade += item.quantidade;
    } else {
        itens.push(item);
    }

    salvarCarrinho(itens);
}

export function atualizarQuantidade(indice, quantidade) {
    const itens = getCarrinho();
    if (!itens[indice]) return;

    if (quantidade < 1) {
        itens.splice(indice, 1);
    } else {
        itens[indice].quantidade = quantidade;
    }

    salvarCarrinho(itens);
}

export function removerItem(indice) {
    const itens = getCarrinho();
    itens.splice(indice, 1);
    salvarCarrinho(itens);
}

// Usado ao editar as variações de um produto que já está no carrinho: some
// com todas as linhas antigas antes de adicionar as novas quantidades.
export function removerItensDoProduto(produtoId) {
    const itens = getCarrinho().filter((item) => item.produtoId !== produtoId);
    salvarCarrinho(itens);
}

export function limparCarrinho() {
    salvarCarrinho([]);
}

export function totalCarrinho() {
    return getCarrinho().reduce((soma, item) => soma + item.preco * item.quantidade, 0);
}

export function quantidadeTotalCarrinho() {
    return getCarrinho().reduce((soma, item) => soma + item.quantidade, 0);
}

export function atualizarBadgeCarrinho() {
    const badges = document.querySelectorAll('.badgeCarrinho');
    if (!badges.length) return;

    const quantidade = quantidadeTotalCarrinho();
    badges.forEach((badge) => {
        badge.textContent = quantidade > 99 ? '99+' : String(quantidade);
        badge.style.display = quantidade > 0 ? 'flex' : 'none';
    });
}

document.addEventListener('DOMContentLoaded', atualizarBadgeCarrinho);
