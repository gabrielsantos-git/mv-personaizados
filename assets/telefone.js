// Telefone brasileiro — regra única do site (máscara, normalização, validação).
//   fixo:    (00) 0000-0000   (10 dígitos)
//   celular: (00) 00000-0000  (11 dígitos)
// O formato é escolhido pela quantidade de dígitos. No banco/APIs vai só a
// sequência de dígitos com DDD (ex.: "71987654321"), como já é gravado em
// profiles.telefone. Sempre TEXTO — nunca type="number".

import { somenteDigitos, mascararComCursor as mascararGenerico, ligarMascara } from './mascaraCampo.js';

const MAX_DIGITOS = 11;

// Ajusta o que foi colado/digitado: tira o +55 do país e o 0 de discagem
// de longa distância quando vierem a mais, antes de cortar em 11 dígitos.
function ajustarDigitos(digitos) {
    let d = digitos;
    if (d.length > MAX_DIGITOS && d.startsWith('55')) d = d.slice(2);
    if (d.length > MAX_DIGITOS && d.startsWith('0')) d = d.slice(1);
    return d;
}

// Valor que vai para o banco: só dígitos (DDD + número).
export function normalizarTelefone(valor) {
    return ajustarDigitos(somenteDigitos(valor)).slice(0, MAX_DIGITOS);
}

// Máscara progressiva: (7 → (71 → (71) 9 → (71) 9876-5 → (71) 98765-4321
export function formatarTelefone(valor) {
    const d = normalizarTelefone(valor);
    if (d.length === 0) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Mensagem de erro padrão ('' = ok). Vazio não é erro: os telefones do site
// são opcionais; quem exigir telefone trata à parte.
export function mensagemErroTelefone(valor) {
    const d = normalizarTelefone(valor);
    if (d.length === 0) return '';
    if (d.length < 10) return 'Telefone incompleto: informe o DDD e o número.';
    if (d[0] === '0') return 'DDD inválido.';
    return '';
}

// Para EXIBIR um telefone já gravado: formata se for um número brasileiro
// com DDD (10 ou 11 dígitos); qualquer outro valor antigo aparece como está.
export function exibirTelefone(valor) {
    const texto = String(valor ?? '').trim();
    const d = somenteDigitos(texto);
    if (d.length === 10 || d.length === 11) return formatarTelefone(d);
    return texto;
}

export function mascararComCursor(valorBruto, cursor) {
    return mascararGenerico(valorBruto, cursor, formatarTelefone, MAX_DIGITOS, ajustarDigitos);
}

export function aplicarMascaraTelefone(input, opcoes = {}) {
    if (!input) return null;
    return ligarMascara(input, {
        formatar: formatarTelefone,
        maxDigitos: MAX_DIGITOS,
        normalizar: ajustarDigitos,
        mensagemErro: mensagemErroTelefone,
        aoValidar: opcoes.aoValidar,
        aoMudar: opcoes.aoMudar
    });
}
