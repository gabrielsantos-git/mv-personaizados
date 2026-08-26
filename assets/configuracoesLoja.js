// Busca as informações da empresa (e-mail, telefone, CNPJ, endereço, horário)
// cadastradas em adm/configuracoes.html e injeta nos elementos do rodapé (e da
// página de Contato) que tiverem os ids esperados. Se algum id não existir na
// página, simplesmente ignora — assim o mesmo script serve pra todas as páginas.

import { supabase } from './supabaseClient.js';

function preencherTexto(id, texto) {
    const el = document.getElementById(id);
    if (el && texto) el.textContent = texto;
}

export async function carregarConfiguracoesLoja() {
    const { data, error } = await supabase
        .from('configuracoes_loja')
        .select('email, telefone, cnpj, endereco, horario_atendimento')
        .eq('id', 1)
        .single();

    if (error || !data) return null;

    // Rodapé (presente em quase todas as páginas)
    preencherTexto('footerHorarioAtendimento', data.horario_atendimento ? `Atendimento: ${data.horario_atendimento}` : null);
    preencherTexto('footerTelefoneContato', data.telefone ? `Contato: ${data.telefone}` : null);
    preencherTexto('footerEmailContato', data.email ? `E-mail: ${data.email}` : null);
    preencherTexto('footerEndereco', data.endereco);

    // Página de Contato (card "Onde estamos")
    preencherTexto('contatoEndereco', data.endereco);
    preencherTexto('contatoEmail', data.email);
    preencherTexto('contatoTelefone', data.telefone);

    return data;
}

document.addEventListener('DOMContentLoaded', carregarConfiguracoesLoja);
