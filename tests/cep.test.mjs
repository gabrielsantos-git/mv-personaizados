// Testes da regra de CEP e da consulta ao ViaCEP (assets/cep.js).
// O ViaCEP é simulado com respostas falsas — os testes não dependem de rede.
// Rodar com:  node --test tests/cep.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizarCep, formatarCep, cepCompleto, mensagemErroCep,
    consultarCep, mesclarEndereco
} from '../assets/cep.js';
import { mascararComCursor } from '../assets/mascaraCampo.js';

const mascararCep = (valor, cursor) => mascararComCursor(valor, cursor, formatarCep, 8);

// fetch falso: devolve o JSON informado (ou status HTTP, ou lança erro).
function fetchFalso({ json, status = 200, lancar, atrasoMs = 0 } = {}) {
    const chamadas = [];
    const fn = (url, opcoes = {}) => {
        chamadas.push(url);
        return new Promise((resolve, reject) => {
            const t = setTimeout(() => {
                if (lancar) return reject(lancar);
                resolve({ ok: status >= 200 && status < 300, status, json: async () => json });
            }, atrasoMs);
            opcoes.signal?.addEventListener('abort', () => {
                clearTimeout(t);
                reject(new DOMException('aborted', 'AbortError'));
            });
        });
    };
    fn.chamadas = chamadas;
    return fn;
}

const PRACA_DA_SE = {
    cep: '01001-000', logradouro: 'Praça da Sé', complemento: 'lado ímpar', unidade: '',
    bairro: 'Sé', localidade: 'São Paulo', uf: 'SP', estado: 'São Paulo'
};

describe('máscara e normalização do CEP', () => {
    test('máscara progressiva', () => {
        assert.equal(formatarCep('4'), '4');
        assert.equal(formatarCep('42800'), '42800');
        assert.equal(formatarCep('428000'), '42800-0');
        assert.equal(formatarCep('42800000'), '42800-000');
    });

    test('CEP com zero à esquerda é mantido como texto', () => {
        assert.equal(normalizarCep('01001-000'), '01001000');
        assert.equal(formatarCep('01001000'), '01001-000');
        assert.equal(typeof normalizarCep('01001000'), 'string');
    });

    test('letras e símbolos são removidos; corta em 8 dígitos', () => {
        assert.equal(normalizarCep('CEP: 42.800-000'), '42800000');
        assert.equal(normalizarCep('428000001'), '42800000');
    });

    test('colar com e sem máscara', () => {
        assert.deepEqual(mascararCep('42800-000', 9), { valor: '42800-000', cursor: 9 });
        assert.deepEqual(mascararCep('42800000', 8), { valor: '42800-000', cursor: 9 });
        assert.deepEqual(mascararCep('CEP 01001-000.', 14), { valor: '01001-000', cursor: 9 });
    });

    test('digitação, exclusão e edição mantêm o cursor', () => {
        let valor = '';
        for (const d of '42800000') {
            const r = mascararCep(valor + d, (valor + d).length);
            valor = r.valor;
            assert.equal(r.cursor, valor.length);
        }
        assert.equal(valor, '42800-000');
        // apaga o "0" logo depois do hífen: "42800-|000" -> backspace já tratado no
        // campo; aqui: apaga um dígito do meio "428|00-000" -> "42800-00"
        assert.deepEqual(mascararCep('42800-00', 3), { valor: '42800-00', cursor: 3 });
        // insere no meio
        assert.deepEqual(mascararCep('4128000', 2), { valor: '41280-00', cursor: 2 });
    });

    test('CEP incompleto x completo', () => {
        assert.equal(cepCompleto('42800-000'), true);
        assert.equal(cepCompleto('4280-000'), false);
        assert.match(mensagemErroCep('4280'), /incompleto/);
        assert.equal(mensagemErroCep(''), '');
        assert.equal(mensagemErroCep('42800-000'), '');
    });
});

describe('consultarCep (ViaCEP simulado)', () => {
    test('CEP válido e encontrado', async () => {
        const fetchFn = fetchFalso({ json: PRACA_DA_SE });
        const r = await consultarCep('01001-000', { fetchFn });
        assert.equal(r.status, 'ok');
        assert.deepEqual(r.endereco, { logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP' });
        // consulta com os 8 dígitos, mantendo o zero à esquerda
        assert.equal(fetchFn.chamadas[0], 'https://viacep.com.br/ws/01001000/json/');
    });

    test('CEP inexistente ({"erro": "true"} — formato real do ViaCEP)', async () => {
        const r = await consultarCep('99999-999', { fetchFn: fetchFalso({ json: { erro: 'true' } }) });
        assert.equal(r.status, 'nao_encontrado');
    });

    test('CEP inexistente ({"erro": true})', async () => {
        const r = await consultarCep('99999-999', { fetchFn: fetchFalso({ json: { erro: true } }) });
        assert.equal(r.status, 'nao_encontrado');
    });

    test('CEP incompleto nem chega a consultar', async () => {
        const fetchFn = fetchFalso({ json: PRACA_DA_SE });
        assert.equal((await consultarCep('0100', { fetchFn })).status, 'invalido');
        assert.equal((await consultarCep('', { fetchFn })).status, 'invalido');
        assert.equal(fetchFn.chamadas.length, 0);
    });

    test('falha de conexão NÃO vira "CEP inexistente"', async () => {
        const r = await consultarCep('01001000', { fetchFn: fetchFalso({ lancar: new TypeError('Failed to fetch') }) });
        assert.equal(r.status, 'erro');
    });

    test('ViaCEP fora do ar (HTTP 500/503)', async () => {
        assert.equal((await consultarCep('01001000', { fetchFn: fetchFalso({ status: 503 }) })).status, 'erro');
        assert.equal((await consultarCep('01001000', { fetchFn: fetchFalso({ status: 500 }) })).status, 'erro');
    });

    test('timeout vira erro de consulta', async () => {
        const r = await consultarCep('01001000', { fetchFn: fetchFalso({ json: PRACA_DA_SE, atrasoMs: 500 }), timeoutMs: 30 });
        assert.equal(r.status, 'erro');
    });

    test('consulta cancelada por um CEP mais novo', async () => {
        const controle = new AbortController();
        const p = consultarCep('01001000', { fetchFn: fetchFalso({ json: PRACA_DA_SE, atrasoMs: 200 }), signal: controle.signal });
        controle.abort();
        assert.equal((await p).status, 'cancelado');
    });

    test('valores nulos, vazios ou "undefined" viram texto vazio', async () => {
        const r = await consultarCep('01001000', {
            fetchFn: fetchFalso({ json: { logradouro: null, bairro: '', localidade: 'undefined', uf: '  SP ' } })
        });
        assert.deepEqual(r.endereco, { logradouro: '', bairro: '', localidade: '', uf: 'SP' });
    });
});

describe('mesclarEndereco — o que é preenchido', () => {
    const endereco = { logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP' };

    test('preenche rua, bairro e "Cidade - UF" (padrão do projeto)', () => {
        const vazio = { rua: '', bairro: '', cidade: '' };
        assert.deepEqual(mesclarEndereco(vazio, vazio, endereco), { rua: 'Praça da Sé', bairro: 'Sé', cidade: 'São Paulo - SP' });
    });

    test('formulário com campo de UF próprio', () => {
        const vazio = { rua: '', bairro: '', cidade: '', uf: '' };
        assert.deepEqual(mesclarEndereco(vazio, vazio, endereco), { rua: 'Praça da Sé', bairro: 'Sé', cidade: 'São Paulo', uf: 'SP' });
    });

    test('mantém o número que vem depois da vírgula na rua', () => {
        const atual = { rua: 'Rua Antiga, 123 - fundos', bairro: 'X', cidade: 'Y' };
        assert.equal(mesclarEndereco(atual, atual, endereco).rua, 'Praça da Sé, 123 - fundos');
    });

    test('não mexe em campo editado pela pessoa durante a consulta', () => {
        const snapshot = { rua: '', bairro: '', cidade: '' };
        const atual = { rua: 'Rua que eu digitei', bairro: '', cidade: '' };
        const m = mesclarEndereco(atual, snapshot, endereco);
        assert.equal('rua' in m, false);
        assert.equal(m.bairro, 'Sé');
    });

    test('valor vazio da API não apaga o que já está no campo', () => {
        const atual = { rua: 'Rua X', bairro: 'Centro', cidade: '' };
        const m = mesclarEndereco(atual, atual, { logradouro: '', bairro: '', localidade: 'Camaçari', uf: 'BA' });
        assert.deepEqual(m, { cidade: 'Camaçari - BA' });
    });

    test('campo que não existe no formulário é ignorado (nunca toca complemento/número)', () => {
        const atual = { rua: undefined, bairro: '', cidade: undefined };
        assert.deepEqual(mesclarEndereco(atual, atual, endereco), { bairro: 'Sé' });
    });
});
