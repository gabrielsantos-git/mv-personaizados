-- Validação de CPF no servidor (Supabase/Postgres).
-- Espelha a regra de assets/cpf.js — os testes em tests/cpf.test.mjs rodam os
-- mesmos casos nos dois lados pra garantir que concordam.
--
-- Comportamento:
--   * só age quando o CPF é inserido ou ALTERADO (CPFs já gravados não são
--     revalidados nem reescritos ao salvar outros campos do perfil);
--   * aceita com ou sem máscara (pontos, traço e espaços são removidos);
--   * grava sempre só os 11 dígitos;
--   * recusa letras/símbolos, tamanho diferente de 11, dígitos todos iguais e
--     dígitos verificadores errados -> erro 23514 (check_violation);
--   * CPF vazio/só separadores vira NULL (perfil sem CPF).

create or replace function public.cpf_valido(cpf text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
    soma int;
    resto int;
    dv1 int;
    dv2 int;
    i int;
begin
    if cpf is null or cpf !~ '^[0-9]{11}$' then
        return false;
    end if;
    if cpf ~ '^([0-9])\1{10}$' then
        return false;
    end if;

    soma := 0;
    for i in 1..9 loop
        soma := soma + substr(cpf, i, 1)::int * (11 - i);   -- pesos 10..2
    end loop;
    resto := soma % 11;
    dv1 := case when resto < 2 then 0 else 11 - resto end;
    if dv1 <> substr(cpf, 10, 1)::int then
        return false;
    end if;

    soma := 0;
    for i in 1..10 loop
        soma := soma + substr(cpf, i, 1)::int * (12 - i);   -- pesos 11..2
    end loop;
    resto := soma % 11;
    dv2 := case when resto < 2 then 0 else 11 - resto end;
    return dv2 = substr(cpf, 11, 1)::int;
end;
$$;

create or replace function public.validar_cpf_perfil()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    digitos text;
begin
    if tg_op = 'UPDATE' and new.cpf is not distinct from old.cpf then
        return new;
    end if;
    if new.cpf is null then
        return new;
    end if;

    if new.cpf ~ '[^0-9.[:space:]-]' then
        raise exception 'CPF inválido: use só números.'
            using errcode = '23514';
    end if;

    digitos := regexp_replace(new.cpf, '[^0-9]', '', 'g');
    if digitos = '' then
        new.cpf := null;
        return new;
    end if;

    if not public.cpf_valido(digitos) then
        raise exception 'CPF inválido.'
            using errcode = '23514';
    end if;

    new.cpf := digitos;
    return new;
end;
$$;

drop trigger if exists trg_validar_cpf_perfil on public.profiles;
create trigger trg_validar_cpf_perfil
    before insert or update of cpf on public.profiles
    for each row execute function public.validar_cpf_perfil();

-- ---------------------------------------------------------------------------
-- ROLLBACK (desfaz tudo acima, sem mexer em nenhum dado):
--
--   drop trigger if exists trg_validar_cpf_perfil on public.profiles;
--   drop function if exists public.validar_cpf_perfil();
--   drop function if exists public.cpf_valido(text);
-- ---------------------------------------------------------------------------
