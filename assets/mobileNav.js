// Liga o menu lateral mobile (drawer da direita pra esquerda, aberto pelo
// botão hambúrguer do header) — presente em toda página que usa o header
// padrão (ver assets/style.css).

import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
    const botao = document.getElementById('botaoMenuMobile');
    const nav = document.getElementById('navPrincipal');
    const overlay = document.getElementById('overlayMenuMobile');
    const botaoFechar = document.getElementById('botaoFecharDrawer');
    if (!botao || !nav) return;

    function abrirMenu() {
        nav.classList.add('navAberta');
        overlay?.classList.add('overlayAberto');
        botao.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    }

    function fecharMenu() {
        nav.classList.remove('navAberta');
        overlay?.classList.remove('overlayAberto');
        botao.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    botao.addEventListener('click', () => {
        if (nav.classList.contains('navAberta')) {
            fecharMenu();
        } else {
            abrirMenu();
        }
    });

    botaoFechar?.addEventListener('click', fecharMenu);
    overlay?.addEventListener('click', fecharMenu);

    document.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape') fecharMenu();
    });

    // Fecha o menu ao clicar num link (evita ficar aberto ao navegar).
    nav.addEventListener('click', (evento) => {
        if (evento.target.closest('a')) fecharMenu();
    });

    // Destaca o link da página atual no menu, tipo o "Início" ativo no
    // design do Figma (fundo rosa claro + texto em negrito).
    let paginaAtual = window.location.pathname.split('/').pop();
    if (!paginaAtual) paginaAtual = 'index.html';

    nav.querySelectorAll('ul a').forEach((link) => {
        const hrefPagina = link.getAttribute('href').split('?')[0];
        if (hrefPagina === paginaAtual) link.classList.add('linkNavAtivo');
    });

    // Seção "Minha Conta" do menu: por padrão mostra Login/Criar Conta
    // (igual o design). Se a pessoa já estiver logada, troca pelo atalho
    // direto pra área da conta.
    const linksConta = document.getElementById('linksContaDrawer');
    if (linksConta) {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return;

            linksConta.innerHTML = `
                <a href="minha-conta.html">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Minha Conta
                </a>
            `;
        });
    }
});
