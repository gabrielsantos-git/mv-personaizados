// Protege as páginas do ADM: só deixa renderizar se o usuário estiver logado
// E o perfil dele tiver is_admin = true no banco. Qualquer outro caso, manda
// de volta pro login. O <body> começa escondido (via inline style no HTML)
// pra evitar mostrar a tela por um instante antes do redirecionamento.

import { supabase } from './supabaseClient.js';

(async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        redirecionarParaLogin();
        return;
    }

    const { data: perfil, error } = await supabase
        .from('profiles')
        .select('nome, sobrenome, is_admin')
        .eq('id', session.user.id)
        .single();

    if (error || !perfil || !perfil.is_admin) {
        redirecionarParaLogin();
        return;
    }

    // Libera a página.
    document.body.style.visibility = 'visible';

    // Preenche o nome/email reais de quem está logado, se os elementos existirem.
    const nomeEl = document.querySelector('.nomeUsuarioAdm');
    const emailEl = document.querySelector('.emailUsuarioAdm');
    const avatarEl = document.querySelector('.avatarUsuarioAdm');

    const nomeCompleto = [perfil.nome, perfil.sobrenome].filter(Boolean).join(' ') || 'Admin';
    if (nomeEl) nomeEl.textContent = nomeCompleto;
    if (emailEl) emailEl.textContent = session.user.email;
    if (avatarEl) {
        const iniciais = (perfil.nome ? perfil.nome[0] : '') + (perfil.sobrenome ? perfil.sobrenome[0] : '');
        avatarEl.textContent = (iniciais || 'AD').toUpperCase();
    }

    // Liga o botão de sair, se existir na página.
    const botaoSair = document.getElementById('botaoSairAdm');
    if (botaoSair) {
        botaoSair.addEventListener('click', async () => {
            await supabase.auth.signOut();
            redirecionarParaLogin();
        });
    }

    window.admSession = session;
    window.admPerfil = perfil;
    document.dispatchEvent(new CustomEvent('admAutenticado', { detail: { session, perfil } }));
})();

function redirecionarParaLogin() {
    window.location.href = '../login.html';
}
