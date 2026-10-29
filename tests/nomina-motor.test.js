// Pruebas del motor de nómina: node --test tests/nomina-motor.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/nomina-motor.js');

const SMMLV_2026 = 1750905;
const cerca = (real, esperado, msg) => assert.ok(Math.abs(real - esperado) < 0.01, `${msg}: ${real} ≠ ${esperado}`);

test('Pascua: 2025, 2026 y 2027', () => {
    assert.equal(M.pascua(2025), '2025-04-20');
    assert.equal(M.pascua(2026), '2026-04-05');
    assert.equal(M.pascua(2027), '2027-03-28');
});

test('festivos de 2026 coinciden con el calendario oficial', () => {
    const oficiales = ['2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01',
        '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29', '2026-07-20', '2026-08-07', '2026-08-17',
        '2026-10-12', '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25'];
    assert.deepEqual(Object.keys(M.festivosDe(2026)).sort(), oficiales);
});

test('festivos trasladables de 2027 caen en lunes', () => {
    const f = M.festivosDe(2027);
    for (const fecha of ['2027-01-11', '2027-03-22', '2027-05-10', '2027-05-31', '2027-06-07', '2027-07-05',
        '2027-08-16', '2027-10-18', '2027-11-01', '2027-11-15']) {
        assert.ok(f[fecha], `falta ${fecha}`);
        assert.equal(M.diaSemana(fecha), 1, `${fecha} no es lunes`);
    }
});

test('reglas fechadas: cada tramo cambia el día que dice la ley', () => {
    assert.equal(M.reglasEn('2025-06-30').dominical, 0.75);
    assert.equal(M.reglasEn('2025-07-01').dominical, 0.80);
    assert.equal(M.reglasEn('2026-06-30').dominical, 0.80);
    assert.equal(M.reglasEn('2026-07-01').dominical, 0.90);
    assert.equal(M.reglasEn('2027-07-01').dominical, 1.00);
    assert.equal(M.reglasEn('2026-07-14').divisor, 220);
    assert.equal(M.reglasEn('2026-07-15').divisor, 210);
    assert.equal(M.reglasEn('2025-12-24').inicioNocturno, 21);
    assert.equal(M.reglasEn('2025-12-25').inicioNocturno, 19);
});

test('quincena sin turnos con salario mínimo 2026', () => {
    const r = M.liquidarQuincena({ salario: SMMLV_2026, conAuxilio: true, turnos: [], desde: '2026-10-16' });
    cerca(r.basico, 875452.5, 'básico');
    cerca(r.auxilio, 124547.5, 'auxilio');
    cerca(r.salud, 875452.5 * 0.04, 'salud');
    cerca(r.neto, 875452.5 + 124547.5 - 875452.5 * 0.08, 'neto');
    assert.equal(r.recargos.length, 0);
});

test('turno nocturno del sábado que cruza al domingo: dominical solo después de medianoche', () => {
    const r = M.liquidarQuincena({
        salario: SMMLV_2026, conAuxilio: true, desde: '2026-07-16',
        turnos: [{ fecha: '2026-07-18', entrada: '23:00', salida: '06:00' }]
    });
    const hora = SMMLV_2026 / 210;
    const noct = r.recargos.find(x => x.tipo === 'nocturno');
    const dom = r.recargos.find(x => x.tipo === 'dominical');
    cerca(noct.horas, 7, 'horas nocturnas');
    cerca(noct.valor, 7 * hora * 0.35, 'recargo nocturno');
    cerca(dom.horas, 6, 'horas dominicales');
    assert.equal(dom.tasa, 0.90);
    cerca(dom.valor, 6 * hora * 0.90, 'recargo dominical');
});

test('una quincena que cruza el 1 de julio de 2026 separa el 80 % y el 90 %', () => {
    const r = M.liquidarQuincena({
        salario: SMMLV_2026, conAuxilio: false, desde: '2026-06-16',
        turnos: [
            { fecha: '2026-06-28', entrada: '08:00', salida: '12:00' }, // domingo, 80 %, divisor 220
            { fecha: '2026-07-05', entrada: '08:00', salida: '12:00' }  // domingo, 90 %, divisor 220
        ]
    });
    const doms = r.recargos.filter(x => x.tipo === 'dominical').map(x => x.tasa);
    assert.deepEqual(doms, [0.80, 0.90]);
    cerca(r.recargos[0].valor, 4 * (SMMLV_2026 / 220) * 0.80, 'dominical al 80 %');
});

test('la jornada nocturna empieza a las 7 p. m. desde el 25 de diciembre de 2025', () => {
    const antes = M.liquidarQuincena({ salario: 1423500, conAuxilio: false, desde: '2025-12-16', turnos: [{ fecha: '2025-12-23', entrada: '19:00', salida: '21:00' }] });
    const despues = M.liquidarQuincena({ salario: 1423500, conAuxilio: false, desde: '2025-12-16', turnos: [{ fecha: '2025-12-26', entrada: '19:00', salida: '21:00' }] });
    assert.equal(antes.horas.nocturnas, 0);
    assert.equal(despues.horas.nocturnas, 2);
});

test('auxilio de transporte hasta 2 SMMLV inclusive', () => {
    const base = { conAuxilio: true, turnos: [], desde: '2026-10-01' };
    assert.ok(M.liquidarQuincena({ ...base, salario: 2 * SMMLV_2026 }).auxilio > 0);
    assert.equal(M.liquidarQuincena({ ...base, salario: 2 * SMMLV_2026 + 1 }).auxilio, 0);
});

test('fondo de solidaridad pensional desde 4 SMMLV', () => {
    const r = M.liquidarQuincena({ salario: 4 * SMMLV_2026, conAuxilio: false, turnos: [], desde: '2026-10-01' });
    cerca(r.solidaridad, 2 * SMMLV_2026 * 0.01, 'solidaridad 1 %');
    assert.equal(M.liquidarQuincena({ salario: 3 * SMMLV_2026, conAuxilio: false, turnos: [], desde: '2026-10-01' }).solidaridad, 0);
});

test('avisa cuando una semana supera la jornada máxima', () => {
    const turnos = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']
        .map(fecha => ({ fecha, entrada: '08:00', salida: '16:00' })); // 6 × 8 h = 48 h
    const r = M.liquidarQuincena({ salario: SMMLV_2026, conAuxilio: true, turnos, desde: '2026-10-16' });
    assert.ok(r.avisos.some(a => a.includes('19/10/2026') && a.includes('42 h')));
});
