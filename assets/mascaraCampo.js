// Motor de máscara para campos só de dígitos (CPF, CEP, telefone...).
// Cada tipo de campo só informa como formatar os dígitos e quantos aceita;
// o tratamento de digitação, colagem, exclusão e cursor fica todo aqui.
//
// O valor é sempre tratado como TEXTO (nunca type="number"), pra não perder
// zeros à esquerda nem virar notação científica.

export function somenteDigitos(valor) {
    return String(valor ?? '').replace(/\D/g, '');
}

// Reaplica a máscara num texto qualquer mantendo o cursor logo depois do
// mesmo dígito em que ele estava (editar no meio sem o cursor pular).
// normalizar(digitos) é opcional: ajusta os dígitos antes de cortar no
// máximo (ex.: telefone colado com +55 na frente).
export function mascararComCursor(valorBruto, cursor, formatar, maxDigitos, normalizar) {
    const bruto = String(valorBruto ?? '');
    const posicao = Math.max(0, Math.min(cursor ?? bruto.length, bruto.length));
    const todos = somenteDigitos(bruto);
    const digitos = (normalizar ? normalizar(todos) : todos).slice(0, maxDigitos);
    const digitosAntes = Math.min(somenteDigitos(bruto.slice(0, posicao)).length, digitos.length);
    const valor = formatar(digitos);

    let novoCursor = 0;
    let contados = 0;
    while (novoCursor < valor.length && contados < digitosAntes) {
        if (/\d/.test(valor[novoCursor])) contados++;
        novoCursor++;
    }
    // Sem dígito antes do cursor: fica antes do primeiro dígito, depois de
    // um eventual prefixo fixo da máscara — ex.: "(" do telefone.
    if (digitosAntes === 0) {
        const primeiro = valor.search(/\d/);
        novoCursor = primeiro > 0 ? primeiro : 0;
    }
    return { valor, cursor: novoCursor };
}

// Liga a máscara num <input>.
//   formatar(digitos)      -> texto exibido
//   maxDigitos             -> quantos dígitos o campo aceita
//   normalizar(digitos)    -> opcional, ajusta os dígitos antes do corte
//   mensagemErro(valor)    -> '' se ok, ou o texto do erro (validação ao sair do campo)
//   aoValidar(mensagem)    -> chamado sempre que valida
//   aoMudar(digitos)       -> chamado a cada alteração feita pelo usuário
export function ligarMascara(input, { formatar, maxDigitos, normalizar, mensagemErro, aoValidar, aoMudar } = {}) {
    if (!input || input.dataset.mascara === 'true') return null;
    input.dataset.mascara = 'true';

    // type="number" perderia zeros à esquerda; "tel"/"text" ficam como estão.
    if (input.type === 'number') input.type = 'text';
    input.inputMode = 'numeric';
    input.removeAttribute('maxlength'); // cortaria colagens com texto extra antes da limpeza
    input.value = formatar((normalizar ? normalizar(somenteDigitos(input.value)) : somenteDigitos(input.value)).slice(0, maxDigitos));

    function aplicar(valorBruto, cursor) {
        const r = mascararComCursor(valorBruto, cursor, formatar, maxDigitos, normalizar);
        input.value = r.valor;
        if (document.activeElement === input) input.setSelectionRange(r.cursor, r.cursor);
    }

    function validar() {
        const mensagem = mensagemErro ? mensagemErro(input.value) : '';
        input.setCustomValidity(mensagem);
        if (mensagem) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
        aoValidar?.(mensagem);
        return mensagem;
    }

    function depoisDeMudar() {
        if (input.getAttribute('aria-invalid') === 'true') validar();
        aoMudar?.(somenteDigitos(input.value));
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
        if (inputType?.startsWith('insertFrom') && transferido !== undefined && !/\d/.test(transferido)) {
            evento.preventDefault();
            return;
        }

        // Campo cheio e nada selecionado pra substituir.
        if (inputType === 'insertText' && data && inicio === fim
            && somenteDigitos(valor).length + somenteDigitos(data).length > maxDigitos) {
            evento.preventDefault();
            return;
        }

        // Backspace logo depois de um separador: apaga o dígito anterior a ele
        // (senão a máscara recolocaria o separador e nada mudaria).
        if (inputType === 'deleteContentBackward' && inicio === fim && inicio > 0 && !/\d/.test(valor[inicio - 1])) {
            evento.preventDefault();
            let i = inicio - 1;
            while (i >= 0 && !/\d/.test(valor[i])) i--;
            if (i >= 0) {
                aplicar(valor.slice(0, i) + valor.slice(i + 1), i);
                depoisDeMudar();
            }
            return;
        }

        // Delete logo antes de um separador: apaga o próximo dígito.
        if (inputType === 'deleteContentForward' && inicio === fim && inicio < valor.length && !/\d/.test(valor[inicio])) {
            evento.preventDefault();
            let i = inicio;
            while (i < valor.length && !/\d/.test(valor[i])) i++;
            if (i < valor.length) {
                aplicar(valor.slice(0, i) + valor.slice(i + 1), inicio);
                depoisDeMudar();
            }
        }
    });

    // Rede de segurança para tudo que o beforeinput não cobre (colar,
    // arrastar, autocompletar, teclados de celular que ignoram o
    // preventDefault): tira o que não é dígito e reaplica a máscara.
    input.addEventListener('input', () => {
        aplicar(input.value, input.selectionStart ?? input.value.length);
        depoisDeMudar();
    });

    input.addEventListener('blur', validar);

    return { validar };
}
