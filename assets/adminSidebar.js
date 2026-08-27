// Liga o botão de abrir/fechar a sidebar do admin em telas pequenas
// (tablet/mobile — ver assets/adminResponsivo.css). Em desktop a sidebar
// já fica sempre visível, então esse script não faz nada lá.
document.addEventListener('DOMContentLoaded', () => {
    const botaoAbrir = document.getElementById('botaoAbrirSidebarAdm');
    const sidebar = document.querySelector('.sidebarAdm');
    if (!botaoAbrir || !sidebar) return;

    const overlay = document.createElement('div');
    overlay.className = 'overlaySidebarAdm';
    document.body.appendChild(overlay);

    function fechar() {
        sidebar.classList.remove('sidebarAdmAberta');
        overlay.classList.remove('aberto');
    }

    function abrir() {
        sidebar.classList.add('sidebarAdmAberta');
        overlay.classList.add('aberto');
    }

    botaoAbrir.addEventListener('click', () => {
        if (sidebar.classList.contains('sidebarAdmAberta')) fechar();
        else abrir();
    });

    overlay.addEventListener('click', fechar);

    // Fecha ao navegar pra outra página do menu.
    sidebar.querySelectorAll('.itemMenuAdm').forEach((link) => {
        link.addEventListener('click', fechar);
    });
});
