// CPF — regra única do site (máscara, normalização e validação matemática).
// Qualquer campo de CPF deve usar este módulo, nunca uma regra própria.
// A mesma validação existe no banco (função public.cpf_valido + gatilho em
// public.profiles), porque o front-end sozinho não é confiável; os testes em
// tests/cpf.test.mjs conferem os dois lados com os mesmos casos.
//
// O CPF é sempre tratado como TEXTO (sequência de dígitos), nunca como número:
// número perderia zeros à esquerda (012...) e poderia virar notação científica.
//
// Validação = consistência matemática dos dígitos verificadores. Não comprova
// que o CPF existe, a quem pertence nem a situação na Receita Federal.

const TOTAL_DIGITOS = 11;

export function somenteDigitos(valor) {
    return String(valor ?? '').replace(/\D/g, '');
}

// Valor que vai para o banco/APIs: só os dígitos, sem pontos nem traço.
export function normalizarCpf(valor) {
    return somenteDigitos(valor).slice(0, TOTAL_DIGITOS);
}

// Máscara progressiva 000.000.000-00 (529 → 529, 529982 → 529.982 ...).
export function formatarCpf(valor) {
    const d = normalizarCpf(valor);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function digitoVerificador(digitos, pesoInicial) {
    let soma = 0;
    for (let i = 0; i < digitos.length; i++) {
        soma += Number(digitos[i]) * (pesoInicial - i);
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
}

// Aceita o CPF com ou sem máscara. Letras ou outros símbolos = inválido
// (não são "limpos" silenciosamente). Número em vez de texto = inválido.
export function cpfValido(valor) {
    if (typeof valor !== 'string') return false;
    if (/[^\d.\-\s]/.test(valor)) return false;

    const d = valor.replace(/[.\-\s]/g, '');
    if (!/^\d{11}$/.test(d)) return false;
    if (/^(\d)\1{10}$/.test(d)) return false;

    const dv1 = digitoVerificador(d.slice(0, 9), 10);
    if (dv1 !== Number(d[9])) return false;

    const dv2 = digitoVerificador(d.slice(0, 9) + dv1, 11);
    return dv2 === Number(d[10]);
}

// Mensagem de erro padrão do site para um CPF digitado ('' = sem erro).
// Campo vazio não é erro aqui: quem exigir CPF obrigatório trata à parte.
export function mensagemErroCpf(valor) {
    const d = somenteDigitos(valor);
    if (d.length === 0) return '';
    if (d.length < TOTAL_DIGITOS) return 'CPF incompleto: digite os 11 números.';
    if (!cpfValido(formatarCpf(d))) return 'CPF inválido. Confira os números digitados.';
    return '';
}

// Reaplica a máscara num texto qualquer mantendo o cursor logo depois do
// mesmo dígito em que ele estava (para editar no meio sem o cursor pular).
export function mascararComCursor(valorBruto, cursor) {
    const bruto = String(valorBruto ?? '');
    const posicao = Math.max(0, Math.min(cursor ?? bruto.length, bruto.length));
    const digitos = normalizarCpf(bruto);
    const digitosAntes = Math.min(somenteDigitos(bruto.slice(0, posicao)).length, digitos.length);
    const valor = formatarCpf(digitos);

    let novoCursor = 0;
    let contados = 0;
    while (novoCursor < valor.length && contados < digitosAntes) {
        if (/\d/.test(valor[novoCursor])) contados++;
        novoCursor++;
    }
    return { valor, cursor: novoCursor };
}

// Liga a máscara, a restrição a dígitos e a validação num <input>.
// opcoes.aoValidar(mensagem) é chamado com a mensagem de erro ('' se ok).
export function aplicarMascaraCpf(input, opcoes = {}) {
    if (!input || input.dataset.mascaraCpf === 'true') return;
    input.dataset.mascaraCpf = 'true';

    // type="text" + inputmode="numeric": teclado numérico no celular sem os
    // problemas do type="number" (zeros à esquerda, "e", setinhas, etc.).
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.removeAttribute('maxlength'); // cortaria colagens com texto extra antes da limpeza
    input.value = formatarCpf(input.value);

    function aplicar(valorBruto, cursor) {
        const r = mascararComCursor(valorBruto, cursor);
        input.value = r.valor;
        if (document.activeElement === input) input.setSelectionRange(r.cursor, r.cursor);
    }

    function validar() {
        const mensagem = mensagemErroCpf(input.value);
        input.setCustomValidity(mensagem);
        if (mensagem) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
        opcoes.aoValidar?.(mensagem);
        return mensagem;
    }

    input.addEventListener('beforeinput', (evento) => {
        const { inputType, data } = evento;
        const inicio = input.selectionStart ?? input.value.length;
        const fim = input.selectionEnd ?? inicio;
        const valor = input.value;

        // Digitação de letra/espaço/símbolo: bloqueia já na tecla.
        if (inputType === 'insertText' && data && !/\d/.test(data)) {
            evento.preventDefault();
            return;
        }

        // Colar/arrastar algo sem nenhum número: ignora (não apaga o campo).
        const transferido = evento.dataTransfer?.getData('text/plain');
        if (inputType.startsWith('insertFrom') && transferido !== undefined && !/\d/.test(transferido)) {
            evento.preventDefault();
            return;
        }

        // Já tem 11 dígitos e não há nada selecionado pra substituir.
        if (inputType === 'insertText' && data && inicio === fim
            && somenteDigitos(valor).length + somenteDigitos(data).length > TOTAL_DIGITOS) {
            evento.preventDefault();
            return;
        }

        // Backspace logo depois de "." ou "-": apaga o dígito anterior ao
        // separador (senão a máscara recolocaria o separador e nada mudaria).
        if (inputType === 'deleteContentBackward' && inicio === fim && inicio > 0 && !/\d/.test(valor[inicio - 1])) {
            evento.preventDefault();
            let i = inicio - 1;
            while (i >= 0 && !/\d/.test(valor[i])) i--;
            if (i >= 0) aplicar(valor.slice(0, i) + valor.slice(i + 1), i);
            if (input.getAttribute('aria-invalid') === 'true') validar();
            return;
        }

        // Delete logo antes de um separador: apaga o próximo dígito.
        if (inputType === 'deleteContentForward' && inicio === fim && inicio < valor.length && !/\d/.test(valor[inicio])) {
            evento.preventDefault();
            let i = inicio;
            while (i < valor.length && !/\d/.test(valor[i])) i++;
            if (i < valor.length) aplicar(valor.slice(0, i) + valor.slice(i + 1), inicio);
            if (input.getAttribute('aria-invalid') === 'true') validar();
        }
    });

    // Rede de segurança para tudo que o beforeinput não cobre (colar, arrastar,
    // autocompletar, teclados de celular que ignoram o preventDefault):
    // tira tudo que não é dígito e reaplica a máscara.
    input.addEventListener('input', () => {
        aplicar(input.value, input.selectionStart ?? input.value.length);
        // Se já estava marcado com erro, revalida enquanto a pessoa corrige.
        if (input.getAttribute('aria-invalid') === 'true') validar();
    });

    input.addEventListener('blur', validar);

    return { validar };
}
