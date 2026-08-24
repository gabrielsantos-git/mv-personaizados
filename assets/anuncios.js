// Busca e renderiza os cards de anúncio (banners promocionais) cadastrados
// pelo admin em adm/anuncios.html. As linhas retornadas já vêm filtradas
// pela política de RLS (só anúncios ativos e não-rascunho aparecem aqui).

import { supabase } from './supabaseClient.js';

export async function carregarAnunciosPorTipo(tipo, limite = 3) {
    const { data, error } = await supabase
        .from('anuncios')
        .select('id, titulo, imagem_url, link_destino')
        .eq('tipo', tipo)
        .order('ordem', { ascending: true })
        .limit(limite);

    if (error || !data) return [];
    return data;
}

export function cardsAnuncioHtml(anuncios) {
    return anuncios.map((anuncio) => `
        <a class="clicarProduto anuncioClicavel" href="${anuncio.link_destino || '#'}" data-id="${anuncio.id}">
        <div class="produto">
                <div class="imgAnuncio" style="background-image: url('${anuncio.imagem_url}');" title="${anuncio.titulo.replace(/"/g, '&quot;')}"></div>
        </div>
        </a>
    `).join('');
}

// Variante pra seções que usam .cardAnuncio direto (sem o wrapper .produto),
// como a página de produto.
export function cardsAnuncioSimplesHtml(anuncios) {
    return anuncios.map((anuncio) => `
        <a class="clicarProduto anuncioClicavel" href="${anuncio.link_destino || '#'}" data-id="${anuncio.id}">
            <div class="cardAnuncio" style="background-image: url('${anuncio.imagem_url}');" title="${anuncio.titulo.replace(/"/g, '&quot;')}"></div>
        </a>
    `).join('');
}

// Registra 1 impressão por anúncio renderizado (best-effort, não trava a
// página se falhar) e liga o clique pra registrar métrica antes de navegar.
export function registrarMetricasAnuncio(container) {
    container.querySelectorAll('.anuncioClicavel').forEach((link) => {
        supabase.rpc('registrar_impressao_anuncio', { anuncio_id: link.dataset.id }).then(() => {});

        link.addEventListener('click', () => {
            supabase.rpc('registrar_clique_anuncio', { anuncio_id: link.dataset.id }).then(() => {});
        });
    });
}
