// CEP — regra única do site: máscara 00000-000, normalização (8 dígitos,
// sempre TEXTO pra não perder zeros à esquerda) e consulta automática ao
// ViaCEP (https://viacep.com.br) pra preencher rua, bairro, cidade e UF.
//
// Padrão do projeto pros campos de endereço (não existem campos separados
// de número nem de UF):
//   rua    -> "Logradouro, número"  (o número depois da vírgula é mantido)
//   cidade -> "Cidade - UF"         (ou só a cidade, se o form tiver campo UF)
// Complemento e número nunca são tocados pelo preenchimento automático.

import { somenteDigitos, ligarMascara } from './mascaraCampo.js';

const TOTAL_DIGITOS = 8;
const URL_VIACEP = 'https://viacep.com.br/ws/';
const TEMPO_LIMITE_MS = 8000;

// Valor que vai para o banco: só os 8 dígitos.
export function normalizarCep(valor) {
    return somenteDigitos(valor).slice(0, TOTAL_DIGITOS);
}

// Máscara progressiva: 42800 → 42800, 428000 → 42800-0, 42800000 → 42800-000
export function formatarCep(valor) {
    const d = normalizarCep(valor);
    return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function cepCompleto(valor) {
    return normalizarCep(valor).length === TOTAL_DIGITOS;
}

// '' = ok. Vazio não é erro aqui (quem exige CEP trata à parte).
export function mensagemErroCep(valor) {
    const d = normalizarCep(valor);
    if (d.length === 0 || d.length === TOTAL_DIGITOS) return '';
    return 'CEP incompleto: digite os 8 números.';
}

// Texto útil vindo da API, ou '' (nada de null, vazio ou "undefined").
function textoValido(valor) {
    if (typeof valor !== 'string') return '';
    const t = valor.trim();
    return t === '' || t === 'undefined' || t === 'null' ? '' : t;
}

// Consulta o ViaCEP. Resultado sempre num destes formatos:
//   { status: 'ok', endereco: { logradouro, bairro, localidade, uf } }
//   { status: 'nao_encontrado' }  CEP com 8 dígitos que o ViaCEP não conhece
//   { status: 'invalido' }        não tem 8 dígitos (nem chega a consultar)
//   { status: 'erro' }            falha de rede, timeout ou ViaCEP fora do ar
//   { status: 'cancelado' }       outra consulta mais nova tomou o lugar
// Falha de conexão NUNCA vira 'nao_encontrado'.
export async function consultarCep(cep, { signal, fetchFn = globalThis.fetch, timeoutMs = TEMPO_LIMITE_MS } = {}) {
    const d = somenteDigitos(cep);
    if (d.length !== TOTAL_DIGITOS) return { status: 'invalido' };
    if (signal?.aborted) return { status: 'cancelado' };

    const controle = new AbortController();
    const cancelarPorFora = () => controle.abort();
    signal?.addEventListener('abort', cancelarPorFora);
    const limite = setTimeout(() => controle.abort(), timeoutMs);

    try {
        const resposta = await fetchFn(`${URL_VIACEP}${d}/json/`, { signal: controle.signal });
        if (!resposta.ok) return { status: 'erro' };

        const dados = await resposta.json();
        if (dados?.erro === true || dados?.erro === 'true') return { status: 'nao_encontrado' };

        return {
            status: 'ok',
            endereco: {
                logradouro: textoValido(dados?.logradouro),
                bairro: textoValido(dados?.bairro),
                localidade: textoValido(dados?.localidade),
                uf: textoValido(dados?.uf)
            }
        };
    } catch {
        return { status: signal?.aborted ? 'cancelado' : 'erro' };
    } finally {
        clearTimeout(limite);
        signal?.removeEventListener('abort', cancelarPorFora);
    }
}

// Decide o que preencher. Recebe os valores ATUAIS dos campos, os valores
// de quando a consulta começou (snapshot) e o endereço do ViaCEP. Devolve
// só os campos que devem mudar. Regras:
//   - campo que a pessoa editou durante a consulta (atual ≠ snapshot) não muda;
//   - campo que não existe no formulário (undefined) é ignorado;
//   - valor vazio vindo da API não apaga o que já está no campo;
//   - na rua, o que vem depois da 1ª vírgula (número) é mantido.
export function mesclarEndereco(atual, snapshot, endereco) {
    const mudancas = {};
    const podeMudar = (campo) => atual[campo] !== undefined && atual[campo] === snapshot[campo];

    if (endereco.logradouro && podeMudar('rua')) {
        const virgula = atual.rua.indexOf(',');
        const numero = virgula >= 0 ? atual.rua.slice(virgula) : '';
        mudancas.rua = endereco.logradouro + numero;
    }

    if (endereco.bairro && podeMudar('bairro')) {
        mudancas.bairro = endereco.bairro;
    }

    if (atual.uf !== undefined) {
        // Formulário com campo próprio de UF.
        if (endereco.localidade && podeMudar('cidade')) mudancas.cidade = endereco.localidade;
        if (endereco.uf && podeMudar('uf')) mudancas.uf = endereco.uf;
    } else if (endereco.localidade && podeMudar('cidade')) {
        mudancas.cidade = endereco.uf ? `${endereco.localidade} - ${endereco.uf}` : endereco.localidade;
    }

    for (const [campo, valor] of Object.entries(mudancas)) {
        if (valor === atual[campo]) delete mudancas[campo];
    }
    return mudancas;
}

// Só a máscara/validação de CEP, sem consulta (forms sem campos de endereço).
export function aplicarMascaraCep(input, opcoes = {}) {
    if (!input) return null;
    input.type = 'text';
    input.autocomplete = 'postal-code';
    return ligarMascara(input, {
        formatar: formatarCep,
        maxDigitos: TOTAL_DIGITOS,
        mensagemErro: mensagemErroCep,
        aoValidar: opcoes.aoValidar,
        aoMudar: opcoes.aoMudar
    });
}

const MENSAGENS = {
    carregando: 'Buscando endereço…',
    nao_encontrado: 'CEP não encontrado. Preencha o endereço manualmente.',
    erro: 'Não foi possível consultar o CEP agora. Preencha o endereço manualmente.'
};

// Liga máscara + consulta automática num formulário.
//   campos: { cep, rua, bairro, cidade, uf } — inputs; só "cep" é obrigatório.
//   opcoes.consultar: troca a consulta (testes).
// A busca só acontece quando a PESSOA digita/cola os 8 dígitos — carregar o
// formulário com um CEP já salvo não dispara consulta nem altera o endereço.
export function ligarCep(campos, opcoes = {}) {
    const { cep } = campos;
    if (!cep) return null;
    const consultar = opcoes.consultar || consultarCep;

    cep.type = 'text';
    cep.autocomplete = 'postal-code';

    // Indicador discreto logo abaixo do campo.
    const status = document.createElement('small');
    status.className = 'statusCep';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    cep.insertAdjacentElement('afterend', status);

    function mostrarStatus(texto, tipo = '') {
        status.textContent = texto;
        status.dataset.tipo = tipo;
    }

    let geracao = 0;
    let controle = null;
    let ultimoCep = null;

    function cancelarPendente() {
        geracao++;
        controle?.abort();
        controle = null;
        cep.removeAttribute('aria-busy');
    }

    const nomes = ['rua', 'bairro', 'cidade', 'uf'];
    const lerCampos = () => Object.fromEntries(nomes.map((n) => [n, campos[n] ? campos[n].value : undefined]));

    async function buscar(digitos) {
        cancelarPendente();
        const minha = geracao;
        controle = new AbortController();
        ultimoCep = digitos;
        const snapshot = lerCampos();

        mostrarStatus(MENSAGENS.carregando, 'carregando');
        cep.setAttribute('aria-busy', 'true');

        const resultado = await consultar(digitos, { signal: controle.signal });

        // Outro CEP foi digitado enquanto esperava: descarta a resposta antiga.
        if (minha !== geracao) return;
        cep.removeAttribute('aria-busy');
        controle = null;

        if (resultado.status === 'ok') {
            const mudancas = mesclarEndereco(lerCampos(), snapshot, resultado.endereco);
            for (const [campo, valor] of Object.entries(mudancas)) campos[campo].value = valor;
            mostrarStatus('');
            opcoes.aoPreencher?.(mudancas);
        } else if (resultado.status === 'nao_encontrado') {
            mostrarStatus(MENSAGENS.nao_encontrado, 'aviso');
        } else if (resultado.status === 'erro') {
            ultimoCep = null; // deixa tentar de novo se a pessoa redigitar
            mostrarStatus(MENSAGENS.erro, 'aviso');
        }
    }

    const mascara = ligarMascara(cep, {
        formatar: formatarCep,
        maxDigitos: TOTAL_DIGITOS,
        mensagemErro: mensagemErroCep,
        aoValidar: (mensagem) => {
            if (mensagem) mostrarStatus(mensagem, 'erro');
            else if (status.dataset.tipo === 'erro') mostrarStatus('');
            opcoes.aoValidar?.(mensagem);
        },
        aoMudar: (digitos) => {
            opcoes.aoMudar?.(digitos);
            if (digitos.length !== TOTAL_DIGITOS) {
                // CEP mudou e ficou incompleto: cancela a busca em andamento.
                if (controle) cancelarPendente();
                ultimoCep = null;
                if (status.dataset.tipo !== 'erro') mostrarStatus('');
                return;
            }
            if (digitos !== ultimoCep) buscar(digitos);
        }
    });

    return { validar: () => mascara.validar() };
}
