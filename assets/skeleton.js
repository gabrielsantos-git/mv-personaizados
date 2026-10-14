// TESTE EXPERIMENTAL — Skeleton Loading com Shimmer nos cards de produto.
// Para remover: apagar este arquivo + assets/skeleton.css e tirar as 2 linhas
// que os incluem em index.html e produtos.html.
//
// Como funciona: este script é "clássico" (sem type="module") e fica antes do
// script principal da página, então roda ANTES da busca dos produtos. Ele só
// preenche os containers vazios com cards-esqueleto. Quando os dados chegam,
// o código já existente da página faz `container.innerHTML = ...` e os
// esqueletos somem sozinhos — nenhuma lógica original foi alterada.

(function () {
    function cardSkeleton() {
        return `
            <div class="clicarProduto skeletonCard" aria-hidden="true">
                <div class="produto">
                    <div class="imgProduto skeletonBloco"></div>
                    <h5 class="nomeProduto"><span class="skeletonBloco skeletonLinha" style="width: 80%"></span></h5>
                    <h6 class="descricaoProduto"><span class="skeletonBloco skeletonLinha" style="width: 100%"></span> <span class="skeletonBloco skeletonLinha" style="width: 60%"></span></h6>
                    <div class="infoProduto">
                        <h4 class="preco"><span class="skeletonBloco skeletonLinha skeletonPreco"></span></h4>
                        <span class="cartDescricao skeletonBloco skeletonBotao"></span>
                    </div>
                </div>
            </div>
        `;
    }

    function cards(quantidade) {
        return Array.from({ length: quantidade }, cardSkeleton).join('');
    }

    // Home — "Mais Vendidos" (a página carrega até 5 produtos aqui)
    const gridMaisVendidos = document.getElementById('gridMaisVendidos');
    if (gridMaisVendidos) {
        gridMaisVendidos.innerHTML = cards(5);
    }

    // Home — seções por categoria (começam vazias; cada uma mostra até 5)
    const containerCategorias = document.getElementById('containerCategoriasHome');
    if (containerCategorias && !containerCategorias.children.length) {
        const secao = `
            <section class="produtosLinhas linhaProduto skeletonSecao" aria-hidden="true">
                <div class="infoProdutosLinha">
                    <h3><span class="skeletonBloco skeletonTitulo"></span></h3>
                </div>
                <div class="produtosLinhas rowProduto">${cards(5)}</div>
            </section>
        `;
        containerCategorias.innerHTML = secao + secao;
    }

    // Página de produtos — grade principal
    const produtosGrid = document.getElementById('produtosGrid');
    if (produtosGrid) {
        produtosGrid.innerHTML = cards(8);
    }
})();
