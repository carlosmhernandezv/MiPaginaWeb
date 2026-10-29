/* =========================================================
   Motor de liquidación quincenal — Colombia
   ---------------------------------------------------------
   Sin interfaz: recibe salario y turnos, devuelve el desprendible.
   Cada regla legal está fechada y lleva su norma, porque en
   2025–2027 casi todas cambian a mitad de año. Una quincena que
   cruza una fecha de cambio se liquida minuto a minuto con la
   regla vigente en cada minuto.
   ========================================================= */
(function (raiz) {
    'use strict';

    // ---------- Reglas fechadas (fuente única: la interfaz las muestra tal cual) ----------

    // Ley 2101 de 2021: la jornada baja por tramos cada 15 de julio.
    // El divisor de la hora ordinaria es la jornada semanal × 5 (48 h → 240, 42 h → 210).
    const JORNADA = [
        { desde: '0000-01-01', horas: 48 },
        { desde: '2023-07-15', horas: 47 },
        { desde: '2024-07-15', horas: 46 },
        { desde: '2025-07-15', horas: 44 },
        { desde: '2026-07-15', horas: 42 }
    ];

    // Ley 2466 de 2025: el recargo dominical y festivo sube por tramos cada 1 de julio.
    const DOMINICAL = [
        { desde: '0000-01-01', tasa: 0.75 },
        { desde: '2025-07-01', tasa: 0.80 },
        { desde: '2026-07-01', tasa: 0.90 },
        { desde: '2027-07-01', tasa: 1.00 }
    ];

    // Ley 2466 de 2025: la jornada nocturna empieza a las 7 p. m. desde el 25 de diciembre de 2025.
    const NOCTURNO = [
        { desde: '0000-01-01', inicio: 21 },
        { desde: '2025-12-25', inicio: 19 }
    ];
    const FIN_NOCTURNO = 6;
    const RECARGO_NOCTURNO = 0.35;

    // Salario mínimo y auxilio de transporte por año, con su decreto.
    const MINIMOS = {
        2025: { smmlv: 1423500, auxilio: 200000, norma: 'Decretos 1572 y 1573 de 2024' },
        2026: { smmlv: 1750905, auxilio: 249095, norma: 'Decretos 1469 y 1470 de 2025' }
    };

    const SALUD = 0.04;
    const PENSION = 0.04;
    // Fondo de Solidaridad Pensional (Ley 100 de 1993, art. 27): desde 4 SMMLV.
    const SOLIDARIDAD = [
        { desdeSmmlv: 4, tasa: 0.010 },
        { desdeSmmlv: 16, tasa: 0.012 },
        { desdeSmmlv: 17, tasa: 0.014 },
        { desdeSmmlv: 18, tasa: 0.016 },
        { desdeSmmlv: 19, tasa: 0.018 },
        { desdeSmmlv: 20, tasa: 0.020 }
    ];

    const NORMAS = {
        jornada: 'Ley 2101 de 2021',
        dominical: 'Ley 2466 de 2025',
        nocturno: 'Ley 2466 de 2025',
        seguridadSocial: 'Ley 100 de 1993'
    };

    // ---------- Fechas como texto AAAA-MM-DD, sin zonas horarias ----------

    function aUTC(fecha) {
        const [a, m, d] = fecha.split('-').map(Number);
        return Date.UTC(a, m - 1, d);
    }

    function desdeUTC(ms) {
        return new Date(ms).toISOString().slice(0, 10);
    }

    function sumarDias(fecha, dias) {
        return desdeUTC(aUTC(fecha) + dias * 86400000);
    }

    function diaSemana(fecha) {
        return new Date(aUTC(fecha)).getUTCDay(); // 0 = domingo
    }

    function vigente(tramos, fecha) {
        let actual = tramos[0];
        for (const t of tramos) if (t.desde <= fecha) actual = t;
        return actual;
    }

    function minimosDe(fecha) {
        const anio = Number(fecha.slice(0, 4));
        const conocidos = Object.keys(MINIMOS).map(Number).sort((a, b) => a - b);
        const usado = conocidos.filter(a => a <= anio).pop() || conocidos[0];
        return { anio: usado, exacto: usado === anio, ...MINIMOS[usado] };
    }

    // ---------- Festivos de Colombia (Ley 51 de 1983, «Ley Emiliani») ----------

    function pascua(anio) {
        // Algoritmo de Butcher para el domingo de Pascua (calendario gregoriano).
        const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
        const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
        return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }

    function siguienteLunes(fecha) {
        const ds = diaSemana(fecha);
        return ds === 1 ? fecha : sumarDias(fecha, (8 - ds) % 7);
    }

    const cacheFestivos = {};
    function festivosDe(anio) {
        if (cacheFestivos[anio]) return cacheFestivos[anio];
        const f = (mmdd) => `${anio}-${mmdd}`;
        const p = pascua(anio);
        const lista = [
            [f('01-01'), 'Año Nuevo'],
            [siguienteLunes(f('01-06')), 'Reyes Magos'],
            [siguienteLunes(f('03-19')), 'San José'],
            [sumarDias(p, -3), 'Jueves Santo'],
            [sumarDias(p, -2), 'Viernes Santo'],
            [f('05-01'), 'Día del Trabajo'],
            [sumarDias(p, 43), 'Ascensión del Señor'],
            [sumarDias(p, 64), 'Corpus Christi'],
            [sumarDias(p, 71), 'Sagrado Corazón'],
            [siguienteLunes(f('06-29')), 'San Pedro y San Pablo'],
            [f('07-20'), 'Día de la Independencia'],
            [f('08-07'), 'Batalla de Boyacá'],
            [siguienteLunes(f('08-15')), 'Asunción de la Virgen'],
            [siguienteLunes(f('10-12')), 'Día de la Raza'],
            [siguienteLunes(f('11-01')), 'Todos los Santos'],
            [siguienteLunes(f('11-11')), 'Independencia de Cartagena'],
            [f('12-08'), 'Inmaculada Concepción'],
            [f('12-25'), 'Navidad']
        ];
        const mapa = {};
        for (const [fecha, nombre] of lista) mapa[fecha] = nombre;
        cacheFestivos[anio] = mapa;
        return mapa;
    }

    function festivo(fecha) {
        return festivosDe(Number(fecha.slice(0, 4)))[fecha] || null;
    }

    // Domingo o festivo: devuelve el motivo o null.
    function diaDeDescanso(fecha) {
        const nombre = festivo(fecha);
        if (nombre) return nombre;
        return diaSemana(fecha) === 0 ? 'Domingo' : null;
    }

    // ---------- Turnos ----------

    function aMinutos(hora) {
        const [h, m] = hora.split(':').map(Number);
        return h * 60 + m;
    }

    // Duración en minutos; si la salida es menor o igual a la entrada, el turno cruza medianoche.
    function duracion(entrada, salida) {
        const e = aMinutos(entrada), s = aMinutos(salida);
        return s > e ? s - e : s + 1440 - e;
    }

    // Recorre el turno minuto a minuto: cada minuto se clasifica con la fecha en que ocurre,
    // así un turno del sábado que termina el domingo paga dominical solo después de medianoche.
    function desglosarTurno(turno, salario) {
        const inicio = aMinutos(turno.entrada);
        const total = duracion(turno.entrada, turno.salida);
        const r = { fecha: turno.fecha, minutos: total, nocturnos: 0, festivos: 0, festivosNocturnos: 0, recargos: {} };

        for (let i = 0; i < total; i++) {
            const abs = inicio + i;
            const fecha = sumarDias(turno.fecha, Math.floor(abs / 1440));
            const hora = (abs % 1440) / 60;
            const valorMinuto = salario / (vigente(JORNADA, fecha).horas * 5) / 60;

            const esNoche = hora >= vigente(NOCTURNO, fecha).inicio || hora < FIN_NOCTURNO;
            const esDescanso = diaDeDescanso(fecha) !== null;

            if (esNoche) {
                r.nocturnos++;
                acumular(r.recargos, 'nocturno', RECARGO_NOCTURNO, valorMinuto);
            }
            if (esDescanso) {
                r.festivos++;
                if (esNoche) r.festivosNocturnos++;
                acumular(r.recargos, 'dominical', vigente(DOMINICAL, fecha).tasa, valorMinuto);
            }
        }
        return r;
    }

    function acumular(recargos, tipo, tasa, valorMinuto) {
        const clave = `${tipo}|${tasa}`;
        const item = recargos[clave] || (recargos[clave] = { tipo, tasa, minutos: 0, valor: 0 });
        item.minutos++;
        item.valor += valorMinuto * tasa;
    }

    function lunesDe(fecha) {
        return sumarDias(fecha, -((diaSemana(fecha) + 6) % 7));
    }

    // ---------- Liquidación ----------

    function liquidarQuincena({ salario, conAuxilio, turnos, desde }) {
        const minimos = minimosDe(desde);
        const validos = (turnos || []).filter(t => t.fecha && t.entrada && t.salida && t.entrada !== t.salida);

        const recargos = {};
        const dias = [];
        const semanas = {};
        for (const t of validos) {
            const d = desglosarTurno(t, salario);
            dias.push({ ...d, descanso: diaDeDescanso(t.fecha) });
            for (const item of Object.values(d.recargos)) {
                const clave = `${item.tipo}|${item.tasa}`;
                const total = recargos[clave] || (recargos[clave] = { tipo: item.tipo, tasa: item.tasa, minutos: 0, valor: 0 });
                total.minutos += item.minutos;
                total.valor += item.valor;
            }
            const lunes = lunesDe(t.fecha);
            semanas[lunes] = (semanas[lunes] || 0) + d.minutos;
        }

        const basico = salario / 2;
        const tieneDerecho = salario <= 2 * minimos.smmlv;
        const auxilio = conAuxilio && tieneDerecho ? minimos.auxilio / 2 : 0;

        const listaRecargos = Object.values(recargos)
            .sort((a, b) => (a.tipo === b.tipo ? a.tasa - b.tasa : a.tipo === 'nocturno' ? -1 : 1))
            .map(r => ({ ...r, horas: r.minutos / 60, norma: NORMAS[r.tipo] }));
        const totalRecargos = listaRecargos.reduce((s, r) => s + r.valor, 0);
        const devengado = basico + auxilio + totalRecargos;

        const base = devengado - auxilio;
        const salud = base * SALUD;
        const pension = base * PENSION;
        const tramoFsp = SOLIDARIDAD.filter(t => salario >= t.desdeSmmlv * minimos.smmlv).pop();
        const solidaridad = tramoFsp ? base * tramoFsp.tasa : 0;
        const deducciones = salud + pension + solidaridad;

        const avisos = [];
        if (!minimos.exacto) {
            avisos.push(`El salario mínimo y el auxilio de ${desde.slice(0, 4)} aún no están cargados; se usaron los de ${minimos.anio}.`);
        }
        if (conAuxilio && !tieneDerecho) {
            avisos.push('El salario supera 2 SMMLV: no hay derecho a auxilio de transporte.');
        }
        for (const [lunes, minutos] of Object.entries(semanas)) {
            const tope = vigente(JORNADA, lunes).horas;
            if (minutos / 60 > tope) {
                avisos.push(`Semana del ${fmtFecha(lunes)}: ${fmtHoras(minutos / 60)} h registradas y la jornada máxima es de ${tope} h. Las horas de más serían extras y esta calculadora no las liquida.`);
            }
        }

        const minutos = dias.reduce((s, d) => s + d.minutos, 0);
        return {
            basico, auxilio, recargos: listaRecargos, devengado,
            salud, pension, solidaridad, tasaSolidaridad: tramoFsp ? tramoFsp.tasa : 0, deducciones,
            neto: devengado - deducciones,
            horas: {
                total: minutos / 60,
                nocturnas: dias.reduce((s, d) => s + d.nocturnos, 0) / 60,
                festivas: dias.reduce((s, d) => s + d.festivos, 0) / 60
            },
            dias, avisos, minimos
        };
    }

    function fmtFecha(fecha) {
        return fecha.split('-').reverse().join('/');
    }

    function fmtHoras(h) {
        return (Math.round(h * 10) / 10).toString().replace('.', ',');
    }

    // Reglas vigentes en una fecha, para mostrarlas en pantalla con su norma.
    function reglasEn(fecha) {
        const minimos = minimosDe(fecha);
        const jornada = vigente(JORNADA, fecha);
        return {
            jornada: jornada.horas, divisor: jornada.horas * 5,
            dominical: vigente(DOMINICAL, fecha).tasa,
            inicioNocturno: vigente(NOCTURNO, fecha).inicio, finNocturno: FIN_NOCTURNO,
            recargoNocturno: RECARGO_NOCTURNO,
            smmlv: minimos.smmlv, auxilio: minimos.auxilio, normaMinimos: minimos.norma, minimosExactos: minimos.exacto,
            salud: SALUD, pension: PENSION, normas: NORMAS
        };
    }

    const api = {
        liquidarQuincena, desglosarTurno, reglasEn, festivo, festivosDe, diaDeDescanso, diaSemana, sumarDias, duracion, pascua,
        tramos: { JORNADA, DOMINICAL, NOCTURNO, MINIMOS }
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else raiz.NominaMotor = api;
})(typeof window !== 'undefined' ? window : globalThis);
