// Liga a busca do cabeçalho (presente em quase toda página da loja):
// - mostra uma prévia com o nome dos produtos enquanto o usuário digita;
// - apertar Enter (ou não escolher nenhuma sugestão) manda pra
//   produtos.html?busca=termo, que faz o filtro completo por nome/descrição.

import { supabase } from './supabaseClient.js';

function escaparHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('search');
    if (!input) return;

    const estaEmProdutos = window.location.pathname.endsWith('produtos.html');
    if (estaEmProdutos) {
        const termoAtual = new URLSearchParams(window.location.search).get('busca');
        if (termoAtual) input.value = termoAtual;
    }

    // Envolve o input num wrapper posicionado, pra encaixar a lista de
    // sugestões logo abaixo, sem mexer no HTML de cada página.
    const wrapper = document.createElement('div');
    wrapper.className = 'buscaHeaderWrapper';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const dropdown = document.createElement('div');
    dropdown.className = 'autocompleteBusca';
    wrapper.appendChild(dropdown);

    function irParaBusca(termo) {
        const destino = termo ? `produtos.html?busca=${encodeURIComponent(termo)}` : 'produtos.html';
        window.location.href = destino;
    }

    function fecharDropdown() {
        dropdown.classList.remove('aberto');
        dropdown.innerHTML = '';
    }

    function renderizarSugestoes(produtos, termo) {
        if (produtos.length === 0) {
            fecharDropdown();
            return;
        }

        dropdown.innerHTML = produtos.map((p) => `
            <a href="produto.html?id=${p.id}" class="itemAutocompleteBusca">${escaparHtml(p.nome)}</a>
        `).join('') + `
            <button type="button" class="itemAutocompleteBusca itemAutocompleteBuscaTudo" data-termo="${escaparHtml(termo)}">Ver todos os resultados para "${escaparHtml(termo)}"</button>
        `;
        dropdown.classList.add('aberto');
    }

    let temporizadorBusca = null;

    input.addEventListener('input', () => {
        const termo = input.value.trim();
        clearTimeout(temporizadorBusca);

        if (termo.length < 2) {
            fecharDropdown();
            return;
        }

        temporizadorBusca = setTimeout(async () => {
            const { data } = await supabase
                .from('produtos')
                .select('id, nome')
                .eq('status', 'ativo')
                .eq('publico', true)
                .ilike('nome', `%${termo}%`)
                .limit(6);

            // Evita mostrar um resultado desatualizado se o usuário já apagou/trocou o termo.
            if (input.value.trim() === termo) renderizarSugestoes(data || [], termo);
        }, 250);
    });

    dropdown.addEventListener('click', (evento) => {
        const botaoTudo = evento.target.closest('.itemAutocompleteBuscaTudo');
        if (botaoTudo) irParaBusca(botaoTudo.dataset.termo);
    });

    input.addEventListener('keydown', (evento) => {
        if (evento.key !== 'Enter') return;
        evento.preventDefault();
        irParaBusca(input.value.trim());
    });

    input.addEventListener('focus', () => {
        if (dropdown.innerHTML) dropdown.classList.add('aberto');
    });

    document.addEventListener('click', (evento) => {
        if (!wrapper.contains(evento.target)) fecharDropdown();
    });
});
