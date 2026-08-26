// Liga a busca do cabeçalho (presente em quase toda página da loja). Ao
// apertar Enter, manda pra produtos.html?busca=termo, que faz o filtro de
// verdade. Se a página atual já for produtos.html, só recarrega com o termo.

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('search');
    if (!input) return;

    const estaEmProdutos = window.location.pathname.endsWith('produtos.html');
    if (estaEmProdutos) {
        const termoAtual = new URLSearchParams(window.location.search).get('busca');
        if (termoAtual) input.value = termoAtual;
    }

    input.addEventListener('keydown', (evento) => {
        if (evento.key !== 'Enter') return;
        evento.preventDefault();

        const termo = input.value.trim();
        const destino = termo ? `produtos.html?busca=${encodeURIComponent(termo)}` : 'produtos.html';
        window.location.href = destino;
    });
});
