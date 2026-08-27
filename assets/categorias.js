// Categorias de produto agora vêm do banco (tabela `categorias`) em vez de
// serem uma lista fixa espalhada pelo código — dá pra criar, renomear e
// excluir pela página de Configurações (adm/configuracoes.html).
import { supabase } from './supabaseClient.js';

export async function carregarCategorias() {
    const { data, error } = await supabase
        .from('categorias')
        .select('slug, nome')
        .order('criado_em');

    if (error) return [];
    return data || [];
}

// Monta um mapa { slug: nome } pra troca rápida, no mesmo formato que o
// antigo objeto "nomesCategoria" hardcoded.
export function mapaNomesCategoria(categorias) {
    const mapa = {};
    categorias.forEach((c) => { mapa[c.slug] = c.nome; });
    return mapa;
}

// Paleta de cores do badge de categoria (usada no PDV e na lista de produtos
// do admin) — como as categorias agora são dinâmicas, a cor é escolhida pela
// posição da categoria na lista em vez de um nome fixo por categoria.
const PALETA_CORES_CATEGORIA = ['categoriaCor0', 'categoriaCor1', 'categoriaCor2', 'categoriaCor3', 'categoriaCor4'];

export function classeCorCategoria(slug, categorias) {
    const indice = categorias.findIndex((c) => c.slug === slug);
    return PALETA_CORES_CATEGORIA[(indice < 0 ? 0 : indice) % PALETA_CORES_CATEGORIA.length];
}
