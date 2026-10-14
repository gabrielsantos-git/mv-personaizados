// Testes da regra de telefone (assets/telefone.js).
// Rodar com:  node --test tests/telefone.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizarTelefone, formatarTelefone, mensagemErroTelefone,
    exibirTelefone, mascararComCursor
} from '../assets/telefone.js';

describe('formatação fixo x celular', () => {
    test('celular (11 dígitos)', () => assert.equal(formatarTelefone('71987654321'), '(71) 98765-4321'));
    test('fixo (10 dígitos)', () => assert.equal(formatarTelefone('7133334444'), '(71) 3333-4444'));

    test('máscara progressiva durante a digitação', () => {
        const esperado = ['(7', '(71', '(71) 9', '(71) 98', '(71) 987', '(71) 9876',
            '(71) 9876-5', '(71) 9876-54', '(71) 9876-543', '(71) 9876-5432', '(71) 98765-4321'];
        const digitos = '71987654321';
        for (let i = 1; i <= digitos.length; i++) {
            assert.equal(formatarTelefone(digitos.slice(0, i)), esperado[i - 1]);
        }
    });

    test('DDD é preservado', () => {
        assert.equal(formatarTelefone('11912345678').slice(0, 4), '(11)');
        assert.equal(normalizarTelefone('(85) 3222-1111').slice(0, 2), '85');
    });
});

describe('normalização (valor que vai pro banco)', () => {
    test('entrada com máscara vira só dígitos', () => {
        assert.equal(normalizarTelefone('(71) 98765-4321'), '71987654321');
        assert.equal(normalizarTelefone('(71) 3333-4444'), '7133334444');
    });
    test('entrada sem máscara continua igual', () => assert.equal(normalizarTelefone('71987654321'), '71987654321'));
    test('é texto, não número', () => assert.equal(typeof normalizarTelefone('71987654321'), 'string'));
    test('letras e símbolos são removidos', () => assert.equal(normalizarTelefone('tel: 71 a98765#4321!'), '71987654321'));
    test('colado com +55 do país', () => assert.equal(normalizarTelefone('+55 (71) 98765-4321'), '71987654321'));
    test('colado com 0 de longa distância', () => assert.equal(normalizarTelefone('0 71 98765-4321'), '71987654321'));
    test('mais de 11 dígitos é cortado', () => assert.equal(normalizarTelefone('7198765432199'), '71987654321'));
});

describe('mascararComCursor — digitação, colagem, exclusão, edição', () => {
    test('digitando um dígito por vez o cursor fica no fim', () => {
        let valor = '';
        for (const d of '71987654321') {
            const r = mascararComCursor(valor + d, (valor + d).length);
            valor = r.valor;
            assert.equal(r.cursor, valor.length, valor);
        }
        assert.equal(valor, '(71) 98765-4321');
    });

    test('letras e caracteres especiais digitados são descartados', () => {
        assert.deepEqual(mascararComCursor('(71a', 4), { valor: '(71', cursor: 3 });
        assert.deepEqual(mascararComCursor('(71) 9#', 7), { valor: '(71) 9', cursor: 6 });
    });

    test('colar celular com máscara', () => {
        assert.deepEqual(mascararComCursor('(71) 98765-4321', 15), { valor: '(71) 98765-4321', cursor: 15 });
    });
    test('colar celular sem máscara', () => {
        assert.deepEqual(mascararComCursor('71987654321', 11), { valor: '(71) 98765-4321', cursor: 15 });
    });
    test('colar fixo sem máscara', () => {
        assert.deepEqual(mascararComCursor('7133334444', 10), { valor: '(71) 3333-4444', cursor: 14 });
    });
    test('colar com +55', () => {
        assert.deepEqual(mascararComCursor('+55 71 98765-4321', 17), { valor: '(71) 98765-4321', cursor: 15 });
    });

    test('apagar o último dígito do celular volta pro formato de fixo', () => {
        // "(71) 98765-432|1" -> apaga o "1"
        assert.deepEqual(mascararComCursor('(71) 98765-432', 14), { valor: '(71) 9876-5432', cursor: 14 });
    });

    test('apagar dígito no meio mantém o cursor', () => {
        // "(71) 98765-4321" -> apaga o "8" (posição 6)
        const r = mascararComCursor('(71) 9765-4321', 6);
        assert.equal(r.valor, '(71) 9765-4321');
        assert.equal(r.cursor, 6);
    });

    test('inserir dígito no meio mantém o cursor logo depois dele', () => {
        // fixo "(71) 3|333-4444" + digita 9 -> vira celular
        const r = mascararComCursor('(71) 39333-4444', 7);
        assert.equal(r.valor, '(71) 39333-4444');
        assert.equal(r.cursor, 7);
    });

    test('trocar o DDD (selecionado) por outro', () => {
        assert.deepEqual(mascararComCursor('(11) 98765-4321', 3), { valor: '(11) 98765-4321', cursor: 3 });
    });

    test('apagar tudo', () => assert.deepEqual(mascararComCursor('', 0), { valor: '', cursor: 0 }));
});

describe('mensagens e exibição de dados antigos', () => {
    test('vazio não é erro (telefones são opcionais)', () => assert.equal(mensagemErroTelefone(''), ''));
    test('fixo e celular completos são ok', () => {
        assert.equal(mensagemErroTelefone('(71) 3333-4444'), '');
        assert.equal(mensagemErroTelefone('(71) 98765-4321'), '');
    });
    test('incompleto', () => assert.match(mensagemErroTelefone('(71) 9876'), /incompleto/));
    test('DDD começando com 0', () => assert.match(mensagemErroTelefone('0198765432'), /DDD/));

    test('exibirTelefone formata o que está gravado só com dígitos', () => {
        assert.equal(exibirTelefone('71987654321'), '(71) 98765-4321');
        assert.equal(exibirTelefone('(71) 3333-4444'), '(71) 3333-4444');
    });
    test('exibirTelefone mostra como está um valor antigo fora do padrão', () => {
        assert.equal(exibirTelefone('ramal 2030'), 'ramal 2030');
        assert.equal(exibirTelefone(''), '');
        assert.equal(exibirTelefone(null), '');
    });
});
