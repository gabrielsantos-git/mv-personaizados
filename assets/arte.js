// Escolha de arte da personalização, feita no carrinho e usada no checkout.
// Guardada no localStorage (igual o carrinho) — o arquivo em si já é
// enviado pro Storage assim que o cliente escolhe, e só a URL fica salva.

const CHAVE_ARTE = 'mv_arte';
export const TAXA_ARTE_LOJA = 50;

// arte: { tipo: 'cliente' | 'loja', arteUrl, arteNomeArquivo, descricao }
export function getArte() {
    try {
        const bruto = localStorage.getItem(CHAVE_ARTE);
        return bruto ? JSON.parse(bruto) : null;
    } catch {
        return null;
    }
}

export function salvarArte(arte) {
    localStorage.setItem(CHAVE_ARTE, JSON.stringify(arte));
}

export function limparArte() {
    localStorage.removeItem(CHAVE_ARTE);
}

export function taxaArte(arte) {
    return arte && arte.tipo === 'loja' ? TAXA_ARTE_LOJA : 0;
}
