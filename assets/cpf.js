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

import { somenteDigitos, mascararComCursor as mascararGenerico, ligarMascara } from './mascaraCampo.js';

export { somenteDigitos };

const TOTAL_DIGITOS = 11;

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

// Reaplica a máscara de CPF mantendo o cursor no mesmo dígito.
export function mascararComCursor(valorBruto, cursor) {
    return mascararGenerico(valorBruto, cursor, formatarCpf, TOTAL_DIGITOS);
}

// Liga a máscara, a restrição a dígitos e a validação num <input> de CPF.
// opcoes.aoValidar(mensagem) é chamado com a mensagem de erro ('' se ok).
export function aplicarMascaraCpf(input, opcoes = {}) {
    if (!input) return null;
    input.type = 'text';
    input.autocomplete = 'off';
    return ligarMascara(input, {
        formatar: formatarCpf,
        maxDigitos: TOTAL_DIGITOS,
        mensagemErro: mensagemErroCpf,
        aoValidar: opcoes.aoValidar
    });
}
