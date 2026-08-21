// Protege as páginas da área "Minha Conta": só deixa renderizar se o usuário
// estiver logado. Qualquer outro caso, manda pro login. O <body> começa
// escondido (via inline style no HTML) pra evitar mostrar a tela por um
// instante antes do redirecionamento.

import { supabase } from './supabaseClient.js';

(async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        redirecionarParaLogin();
        return;
    }

    const { data: perfil } = await supabase
        .from('profiles')
        .select('nome, sobrenome, telefone, cep, cpf, rua, bairro, cidade, complemento')
        .eq('id', session.user.id)
        .single();

    // Libera a página.
    document.body.style.visibility = 'visible';

    // Preenche o nome/email reais de quem está logado, se os elementos existirem.
    const nomeEl = document.querySelector('.nomeUsuarioConta');
    const emailEl = document.querySelector('.emailUsuarioConta');
    const avatarEl = document.querySelector('.avatarUsuarioConta');

    const nomeCompleto = [perfil?.nome, perfil?.sobrenome].filter(Boolean).join(' ') || 'Minha Conta';
    if (nomeEl) nomeEl.textContent = nomeCompleto;
    if (emailEl) emailEl.textContent = session.user.email;
    if (avatarEl) {
        const iniciais = (perfil?.nome ? perfil.nome[0] : '') + (perfil?.sobrenome ? perfil.sobrenome[0] : '');
        avatarEl.textContent = (iniciais || session.user.email[0]).toUpperCase();
    }

    // Liga o botão de sair, se existir na página.
    const botaoSair = document.getElementById('botaoSairConta');
    if (botaoSair) {
        botaoSair.addEventListener('click', async () => {
            await supabase.auth.signOut();
            redirecionarParaLogin();
        });
    }

    window.contaSession = session;
    window.contaPerfil = perfil;
    document.dispatchEvent(new CustomEvent('contaAutenticada', { detail: { session, perfil } }));
})();

function redirecionarParaLogin() {
    window.location.href = 'login.html';
}
