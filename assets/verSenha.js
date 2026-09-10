// Adiciona o botão de mostrar/esconder senha em todo campo de senha das
// telas de auth (login, cadastro, redefinição de senha). O CSS fica em
// assets/style.css (.campoSenhaWrapper / .botaoVerSenha).

const OLHO = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const OLHO_CORTADO = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';

function ligarVerSenha() {
    document.querySelectorAll('.campoLogin input[type="password"]').forEach((input) => {
        if (input.closest('.campoSenhaWrapper')) return; // já ligado

        const wrapper = document.createElement('div');
        wrapper.className = 'campoSenhaWrapper';
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'botaoVerSenha';
        botao.setAttribute('aria-label', 'Mostrar senha');
        botao.innerHTML = OLHO;
        wrapper.appendChild(botao);

        botao.addEventListener('click', () => {
            const escondida = input.type === 'password';
            input.type = escondida ? 'text' : 'password';
            botao.innerHTML = escondida ? OLHO_CORTADO : OLHO;
            botao.setAttribute('aria-label', escondida ? 'Esconder senha' : 'Mostrar senha');
            input.focus();
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ligarVerSenha);
} else {
    ligarVerSenha();
}
