// Substitui os diálogos nativos do navegador (alert/confirm) por modais
// próprios do site, consistentes com o resto do visual. Uso:
//
//   import { confirmModal, alertModal } from './assets/modal.js'; (loja)
//   import { confirmModal, alertModal } from '../assets/modal.js'; (admin)
//
//   const ok = await confirmModal('Excluir "Produto X"? Essa ação não pode ser desfeita.');
//   if (!ok) return;
//
//   await alertModal('Não foi possível excluir o produto.');
//
// Ambas retornam uma Promise (confirmModal resolve com true/false,
// alertModal resolve quando o usuário fecha o aviso) — dá pra usar com
// await no lugar exato onde estava o confirm()/alert() nativo.

let estilosInjetados = false;

function injetarEstilos() {
    if (estilosInjetados) return;
    estilosInjetados = true;

    const style = document.createElement('style');
    style.textContent = `
        .mvModalOverlay{
            position: fixed;
            inset: 0;
            z-index: 1000;

            display: flex;
            align-items: center;
            justify-content: center;

            background-color: rgba(0, 0, 0, 0.5);
            padding: 20px;
            box-sizing: border-box;
        }

        .mvModalCaixa{
            background-color: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);

            width: 100%;
            max-width: 420px;
            max-height: 85vh;
            overflow-y: auto;

            padding: 28px;
            box-sizing: border-box;
        }

        .mvModalCaixa h3{
            font-family: 'Almarai', sans-serif;
            font-size: 20px;
            font-weight: 700;
            color: black;
            margin: 0 0 12px;
        }

        .mvModalCaixa p{
            font-family: 'Almarai', sans-serif;
            font-size: 14px;
            font-weight: 300;
            color: #333;
            margin: 0 0 24px;
            white-space: pre-line;
        }

        .mvModalAcoes{
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .mvModalAcoes button{
            width: 100%;
            box-sizing: border-box;
            border-radius: 10px;
            padding: 12px;
            cursor: pointer;

            font-family: 'Almarai', sans-serif;
            font-size: 15px;
            font-weight: 700;
        }

        .mvModalBotaoPrimario{
            background-color: var(--cor-primaria, #A70C24);
            border: none;
            color: white;
        }

        .mvModalBotaoPrimario:hover{
            background-color: var(--cor-quintenaria, #E32F4C);
        }

        .mvModalBotaoSecundario{
            background-color: white;
            border: 1px solid var(--cor-primaria, #A70C24);
            color: var(--cor-primaria, #A70C24);
        }

        .mvModalBotaoSecundario:hover{
            background-color: var(--cor-quaternaria, #a70c2352);
        }

        .mvModalCampoSenha{
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #ddd;
            border-radius: 10px;
            padding: 12px 14px;
            margin: -12px 0 16px;

            font-family: 'Almarai', sans-serif;
            font-size: 15px;
            color: black;
        }

        .mvModalCampoSenha:focus{
            outline: none;
            border-color: var(--cor-primaria, #A70C24);
        }

        .mvModalErroSenha{
            font-family: 'Almarai', sans-serif;
            font-size: 13px;
            font-weight: 700;
            color: #dc2626;
            margin: -10px 0 16px;
        }
    `;
    document.head.appendChild(style);
}

function criarModal({ titulo, mensagem, botoes, permiteFecharFora }) {
    injetarEstilos();

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'mvModalOverlay';

        const caixa = document.createElement('div');
        caixa.className = 'mvModalCaixa';

        if (titulo) {
            const h3 = document.createElement('h3');
            h3.textContent = titulo;
            caixa.appendChild(h3);
        }

        const p = document.createElement('p');
        p.textContent = mensagem;
        caixa.appendChild(p);

        const acoes = document.createElement('div');
        acoes.className = 'mvModalAcoes';
        caixa.appendChild(acoes);

        overlay.appendChild(caixa);

        let resolvido = false;
        function finalizar(valor) {
            if (resolvido) return;
            resolvido = true;
            document.removeEventListener('keydown', aoTeclar);
            overlay.remove();
            resolve(valor);
        }

        function aoTeclar(evento) {
            if (evento.key === 'Escape') finalizar(botoes.valorEscape);
        }
        document.addEventListener('keydown', aoTeclar);

        if (permiteFecharFora) {
            overlay.addEventListener('click', (evento) => {
                if (evento.target === overlay) finalizar(botoes.valorEscape);
            });
        }

        let botaoPrimario = null;
        botoes.lista.forEach((botao) => {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = botao.primario ? 'mvModalBotaoPrimario' : 'mvModalBotaoSecundario';
            el.textContent = botao.texto;
            el.addEventListener('click', () => finalizar(botao.valor));
            acoes.appendChild(el);
            if (botao.primario) botaoPrimario = el;
        });

        document.body.appendChild(overlay);
        (botaoPrimario || acoes.firstElementChild)?.focus();
    });
}

export function confirmModal(mensagem, opcoes) {
    const { titulo, textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar' } = opcoes || {};

    return criarModal({
        titulo,
        mensagem,
        botoes: {
            valorEscape: false,
            lista: [
                { texto: textoCancelar, valor: false, primario: false },
                { texto: textoConfirmar, valor: true, primario: true }
            ]
        },
        permiteFecharFora: true
    });
}

export function alertModal(mensagem, opcoes) {
    const { titulo, textoOk = 'OK' } = opcoes || {};

    return criarModal({
        titulo,
        mensagem,
        botoes: {
            valorEscape: undefined,
            lista: [{ texto: textoOk, valor: undefined, primario: true }]
        },
        permiteFecharFora: true
    });
}

// Modal com botões de ação livres (não é um simples sim/não) — cada botão
// tem seu próprio texto e valor de retorno. Ex: "Inativar produto" /
// "Excluir produto mesmo assim", sem um "Cancelar" separado — fechar com
// Esc ou clicando fora resolve como null (nenhuma ação escolhida).
//
//   const acao = await escolherModal('...', {
//       botoes: [
//           { texto: 'Inativar produto', valor: 'inativar', primario: true },
//           { texto: 'Excluir produto mesmo assim', valor: 'excluir' }
//       ]
//   });
//   if (acao === 'inativar') { ... }
export function escolherModal(mensagem, opcoes) {
    const { titulo, botoes } = opcoes || {};

    return criarModal({
        titulo,
        mensagem,
        botoes: {
            valorEscape: null,
            lista: botoes
        },
        permiteFecharFora: true
    });
}

// Modal que pede uma senha antes de continuar — usado pra confirmar ações
// sensíveis (ex: criar uma promoção). Resolve com a senha digitada ao
// confirmar (Enter ou botão), ou null se cancelar/fechar sem digitar nada.
// Passe `erro` pra mostrar uma mensagem de erro acima do campo (ex: senha
// incorreta, tentativas restantes) quando reabrir o modal numa nova tentativa.
//
//   const senha = await senhaModal('Confirme sua senha pra continuar.', {
//       titulo: 'Confirme sua senha',
//       erro: 'Senha incorreta. Você tem mais 2 tentativas.'
//   });
//   if (senha === null) { /* cancelou */ }
export function senhaModal(mensagem, opcoes) {
    const { titulo, textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar', erro } = opcoes || {};
    injetarEstilos();

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'mvModalOverlay';

        const caixa = document.createElement('div');
        caixa.className = 'mvModalCaixa';

        if (titulo) {
            const h3 = document.createElement('h3');
            h3.textContent = titulo;
            caixa.appendChild(h3);
        }

        const p = document.createElement('p');
        p.textContent = mensagem;
        caixa.appendChild(p);

        const input = document.createElement('input');
        input.type = 'password';
        input.className = 'mvModalCampoSenha';
        input.placeholder = 'Digite sua senha';
        input.autocomplete = 'current-password';
        caixa.appendChild(input);

        if (erro) {
            const erroEl = document.createElement('p');
            erroEl.className = 'mvModalErroSenha';
            erroEl.textContent = erro;
            caixa.appendChild(erroEl);
        }

        const acoes = document.createElement('div');
        acoes.className = 'mvModalAcoes';
        caixa.appendChild(acoes);

        overlay.appendChild(caixa);

        let resolvido = false;
        function finalizar(valor) {
            if (resolvido) return;
            resolvido = true;
            document.removeEventListener('keydown', aoTeclar);
            overlay.remove();
            resolve(valor);
        }

        function confirmar() {
            finalizar(input.value ? input.value : null);
        }

        function aoTeclar(evento) {
            if (evento.key === 'Escape') finalizar(null);
            if (evento.key === 'Enter' && document.activeElement === input) confirmar();
        }
        document.addEventListener('keydown', aoTeclar);

        overlay.addEventListener('click', (evento) => {
            if (evento.target === overlay) finalizar(null);
        });

        const botaoCancelar = document.createElement('button');
        botaoCancelar.type = 'button';
        botaoCancelar.className = 'mvModalBotaoSecundario';
        botaoCancelar.textContent = textoCancelar;
        botaoCancelar.addEventListener('click', () => finalizar(null));
        acoes.appendChild(botaoCancelar);

        const botaoConfirmar = document.createElement('button');
        botaoConfirmar.type = 'button';
        botaoConfirmar.className = 'mvModalBotaoPrimario';
        botaoConfirmar.textContent = textoConfirmar;
        botaoConfirmar.addEventListener('click', confirmar);
        acoes.appendChild(botaoConfirmar);

        document.body.appendChild(overlay);
        input.focus();
    });
}
