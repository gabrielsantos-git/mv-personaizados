// Testes da regra de CPF (assets/cpf.js) e da validação no banco.
// Rodar com:  node --test tests/cpf.test.mjs
// Usa só o test runner embutido no Node (sem dependências).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    somenteDigitos, normalizarCpf, formatarCpf, cpfValido,
    mensagemErroCpf, mascararComCursor
} from '../assets/cpf.js';

describe('cpfValido — validação matemática', () => {
    test('CPF válido com máscara', () => assert.equal(cpfValido('529.982.247-25'), true));
    test('mesmo CPF sem máscara', () => assert.equal(cpfValido('52998224725'), true));
    test('outro CPF válido', () => assert.equal(cpfValido('123.456.789-09'), true));

    test('CPF iniciado com zero (zero à esquerda preservado)', () => {
        assert.equal(cpfValido('012.345.678-90'), true);
        assert.equal(cpfValido('01234567890'), true);
        assert.equal(normalizarCpf('012.345.678-90'), '01234567890');
    });

    test('primeiro dígito verificador errado', () => assert.equal(cpfValido('529.982.247-35'), false));
    test('segundo dígito verificador errado', () => assert.equal(cpfValido('529.982.247-24'), false));

    test('menos de 11 dígitos', () => {
        assert.equal(cpfValido('5299822472'), false);
        assert.equal(cpfValido('529.982.247-2'), false);
        assert.equal(cpfValido(''), false);
    });

    test('mais de 11 dígitos', () => {
        assert.equal(cpfValido('529982247250'), false);
        assert.equal(cpfValido('529.982.247-250'), false);
    });

    test('todos os dígitos iguais (0 a 9)', () => {
        for (let n = 0; n <= 9; n++) {
            assert.equal(cpfValido(String(n).repeat(11)), false, String(n).repeat(11));
        }
    });

    test('letras e caracteres especiais tornam o CPF inválido (não são ignorados)', () => {
        assert.equal(cpfValido('529a98224725'), false);
        assert.equal(cpfValido('CPF 529.982.247-25'), false);
        assert.equal(cpfValido('529/982/247-25'), false);
        assert.equal(cpfValido('529_982_247_25'), false);
    });

    test('CPF como número (não texto) é recusado — perderia zeros à esquerda', () => {
        assert.equal(cpfValido(52998224725), false);
        assert.equal(cpfValido(null), false);
        assert.equal(cpfValido(undefined), false);
    });
});

describe('normalização e máscara', () => {
    test('somenteDigitos remove tudo que não é número', () => {
        assert.equal(somenteDigitos('CPF: 529.982.247-25 '), '52998224725');
        assert.equal(somenteDigitos('abc'), '');
        assert.equal(somenteDigitos(null), '');
    });

    test('normalizarCpf: sempre texto de no máximo 11 dígitos, sem máscara', () => {
        assert.equal(normalizarCpf('529.982.247-25'), '52998224725');
        assert.equal(normalizarCpf('52998224725999'), '52998224725');
        assert.equal(typeof normalizarCpf('00000000191'), 'string');
    });

    test('máscara progressiva (exemplos do requisito)', () => {
        assert.equal(formatarCpf('529'), '529');
        assert.equal(formatarCpf('5299'), '529.9');
        assert.equal(formatarCpf('529982'), '529.982');
        assert.equal(formatarCpf('5299822'), '529.982.2');
        assert.equal(formatarCpf('529982247'), '529.982.247');
        assert.equal(formatarCpf('5299822472'), '529.982.247-2');
        assert.equal(formatarCpf('52998224725'), '529.982.247-25');
    });

    test('máscara corta o que passar de 11 dígitos', () => {
        assert.equal(formatarCpf('529982247250000'), '529.982.247-25');
    });
});

describe('mascararComCursor — digitação, colagem, exclusão e edição', () => {
    test('digitando um dígito por vez o cursor fica sempre no fim', () => {
        let valor = '';
        for (const d of '52998224725') {
            const r = mascararComCursor(valor + d, (valor + d).length);
            valor = r.valor;
            assert.equal(r.cursor, valor.length);
        }
        assert.equal(valor, '529.982.247-25');
    });

    test('letras e símbolos digitados/colados são descartados', () => {
        assert.deepEqual(mascararComCursor('52a', 3), { valor: '52', cursor: 2 });
        assert.deepEqual(mascararComCursor('529 ', 4), { valor: '529', cursor: 3 });
        assert.deepEqual(mascararComCursor('529.98#', 7), { valor: '529.98', cursor: 6 });
    });

    test('colar CPF com máscara', () => {
        assert.deepEqual(mascararComCursor('529.982.247-25', 14), { valor: '529.982.247-25', cursor: 14 });
    });

    test('colar CPF sem máscara', () => {
        assert.deepEqual(mascararComCursor('52998224725', 11), { valor: '529.982.247-25', cursor: 14 });
    });

    test('colar texto com o CPF no meio', () => {
        const colado = 'CPF: 529.982.247-25.';
        assert.deepEqual(mascararComCursor(colado, colado.length), { valor: '529.982.247-25', cursor: 14 });
    });

    test('inserir dígito no meio mantém o cursor logo depois dele', () => {
        // "529.|982" + digita 1  -> bruto "529.1982", cursor 5
        const r = mascararComCursor('529.1982', 5);
        assert.equal(r.valor, '529.198.2');
        assert.equal(r.cursor, 5); // logo depois do "1"
    });

    test('apagar dígito no meio mantém o cursor no lugar', () => {
        // "529.982.247-25", apaga o "8" (posição 5) -> bruto "529.92.247-25", cursor 5
        const r = mascararComCursor('529.92.247-25', 5);
        assert.equal(r.valor, '529.922.472-5');
        assert.equal(r.cursor, 5);
    });

    test('apagar o último dígito', () => {
        const r = mascararComCursor('529.982.247-2', 13);
        assert.deepEqual(r, { valor: '529.982.247-2', cursor: 13 });
    });

    test('apagar tudo', () => {
        assert.deepEqual(mascararComCursor('', 0), { valor: '', cursor: 0 });
    });

    test('substituir um dígito selecionado no meio', () => {
        // seleciona "9" em "5[2]9..." -> trocado por 7: bruto "579.982.247-25", cursor 2
        assert.deepEqual(mascararComCursor('579.982.247-25', 2), { valor: '579.982.247-25', cursor: 2 });
    });
});

describe('mensagemErroCpf — mensagens padronizadas', () => {
    test('vazio não é erro (campo opcional)', () => assert.equal(mensagemErroCpf(''), ''));
    test('válido não tem erro', () => assert.equal(mensagemErroCpf('529.982.247-25'), ''));
    test('incompleto', () => assert.match(mensagemErroCpf('529.982'), /incompleto/));
    test('dígito verificador errado', () => assert.match(mensagemErroCpf('529.982.247-24'), /inválido/));
    test('todos iguais', () => assert.match(mensagemErroCpf('111.111.111-11'), /inválido/));
});

// Confere que o banco (public.cpf_valido) dá o mesmo resultado do front-end.
// Chama a função pela API pública do Supabase; se não houver rede, pula.
describe('validação no backend concorda com o front-end', () => {
    const URL_SUPABASE = 'https://jaaaihczqiqainhdoned.supabase.co';
    const CHAVE_PUBLICA = 'sb_publishable_s75LBJVysGN-wrqMJLLEqQ_zIRrFxD0';
    const casos = [
        '52998224725', '52998224724', '52998224735', '5299822472', '529982247250',
        '11111111111', '00000000000', '01234567890', '12345678909', '04257306094'
    ];

    test('mesmos resultados para todos os casos', async (t) => {
        for (const cpf of casos) {
            let resposta;
            try {
                resposta = await fetch(`${URL_SUPABASE}/rest/v1/rpc/cpf_valido`, {
                    method: 'POST',
                    headers: {
                        apikey: CHAVE_PUBLICA,
                        Authorization: `Bearer ${CHAVE_PUBLICA}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ cpf })
                });
            } catch {
                t.skip('sem acesso ao Supabase');
                return;
            }
            assert.equal(resposta.ok, true, `RPC falhou (${resposta.status}) para ${cpf}`);
            assert.equal(await resposta.json(), cpfValido(cpf), `banco e front discordam em ${cpf}`);
        }
    });
});
