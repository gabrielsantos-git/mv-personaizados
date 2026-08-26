// Escolha de arte da personalização, uma por PRODUTO do carrinho (não uma
// só pro pedido inteiro) — cada produto pode ter sua própria arte pronta ou
// pedir que a loja crie. Guardada no localStorage (igual o carrinho). O
// arquivo em si já é enviado pro Storage assim que o cliente escolhe, e só
// a URL fica salva aqui.

const CHAVE_ARTE = 'mv_arte_por_produto';
export const TAXA_ARTE_LOJA = 50;

// arte: { tipo: 'cliente' | 'loja', arteUrl, arteNomeArquivo, descricao }
function getTodasArtes() {
    try {
        const bruto = localStorage.getItem(CHAVE_ARTE);
        const obj = bruto ? JSON.parse(bruto) : {};
        return obj && typeof obj === 'object' ? obj : {};
    } catch {
        return {};
    }
}

function salvarTodasArtes(todas) {
    localStorage.setItem(CHAVE_ARTE, JSON.stringify(todas));
}

export function getArtePorProduto(produtoId) {
    return getTodasArtes()[produtoId] || null;
}

export function salvarArtePorProduto(produtoId, arte) {
    const todas = getTodasArtes();
    todas[produtoId] = arte;
    salvarTodasArtes(todas);
}

// Tira do storage as artes de produtos que não estão mais no carrinho.
export function limparArtesForaDoCarrinho(produtoIdsNoCarrinho) {
    const todas = getTodasArtes();
    const idsValidos = new Set(produtoIdsNoCarrinho);
    let mudou = false;

    Object.keys(todas).forEach((produtoId) => {
        if (!idsValidos.has(produtoId)) {
            delete todas[produtoId];
            mudou = true;
        }
    });

    if (mudou) salvarTodasArtes(todas);
}

export function limparArtes() {
    localStorage.removeItem(CHAVE_ARTE);
}

export function taxaArte(arte) {
    return arte && arte.tipo === 'loja' ? TAXA_ARTE_LOJA : 0;
}

// Soma a taxa de "arte pela loja" uma vez por produto (não por linha/variação).
export function taxaTotalArtes(produtoIds) {
    const unicos = [...new Set(produtoIds)];
    return unicos.reduce((soma, id) => soma + taxaArte(getArtePorProduto(id)), 0);
}

// Verdadeiro se algum produto com essa lista de ids está com arte "cliente".
export function algumProdutoComArteDoCliente(produtoIds) {
    return [...new Set(produtoIds)].some((id) => getArtePorProduto(id)?.tipo === 'cliente');
}

// Verdadeiro se todo produto da lista tem uma escolha de arte completa.
export function todasArtesCompletas(produtoIds) {
    return [...new Set(produtoIds)].every((id) => {
        const arte = getArtePorProduto(id);
        if (!arte) return false;
        if (arte.tipo === 'cliente') return !!arte.arteUrl;
        if (arte.tipo === 'loja') return !!arte.descricao;
        return false;
    });
}
