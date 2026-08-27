// Liga o botão de menu hambúrguer do header (aparece só no mobile via CSS) —
// presente em toda página que usa o header padrão (ver assets/style.css).
document.addEventListener('DOMContentLoaded', () => {
    const botao = document.getElementById('botaoMenuMobile');
    const nav = document.getElementById('navPrincipal');
    if (!botao || !nav) return;

    botao.addEventListener('click', () => {
        const aberto = nav.classList.toggle('navAberta');
        botao.setAttribute('aria-expanded', aberto ? 'true' : 'false');
        botao.classList.toggle('botaoMenuAberto', aberto);
    });

    // Fecha o menu ao clicar num link (evita ficar aberto ao navegar).
    nav.addEventListener('click', (evento) => {
        if (evento.target.closest('a')) {
            nav.classList.remove('navAberta');
            botao.setAttribute('aria-expanded', 'false');
            botao.classList.remove('botaoMenuAberto');
        }
    });
});
