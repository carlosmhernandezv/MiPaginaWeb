/* =========================================================
   Calculadora de nómina — interfaz
   El cálculo vive en nomina-motor.js; aquí solo se leen los
   campos, se guarda en el navegador y se pinta el resultado.
   ========================================================= */
(function () {
    'use strict';

    const M = window.NominaMotor;
    const CLAVE = 'nomina-v2';
    const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const $ = (id) => document.getElementById(id);

    const moneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    const dinero = (v) => moneda.format(Math.round(v));
    const horas = (h) => (Math.round(h * 10) / 10).toLocaleString('es-CO');
    const pct = (t) => `${(t * 100).toLocaleString('es-CO')} %`;
    const fecha = (f) => f.split('-').reverse().join('/');
    const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // ---------- Estado guardado en el navegador ----------

    let estado;

    function hoyLocal() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function leer() {
        try {
            const crudo = localStorage.getItem(CLAVE);
            if (crudo) return JSON.parse(crudo);
        } catch (e) { /* almacenamiento bloqueado: se trabaja en memoria */ }
        return null;
    }

    function guardar() {
        try {
            localStorage.setItem(CLAVE, JSON.stringify(estado));
        } catch (e) { /* sin almacenamiento: el cálculo sigue funcionando */ }
    }

    function nuevoId() {
        return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function iniciarEstado() {
        estado = leer();
        if (estado && Array.isArray(estado.empleados) && estado.empleados.length) return;

        const hoy = hoyLocal();
        const smmlv = M.reglasEn(hoy).smmlv;
        estado = { empleados: [], turnos: {}, historial: [], actual: null, mes: hoy.slice(0, 7), quincena: Number(hoy.slice(8)) <= 15 ? 1 : 2 };

        // Trae los empleados de la versión anterior de la calculadora, si existían.
        try {
            const viejo = JSON.parse(localStorage.getItem('nominaData') || 'null');
            for (const e of (viejo && viejo.empleados) || []) {
                estado.empleados.push({ id: nuevoId(), nombre: e.nombre || 'Empleado', salario: Number(e.salarioBase) || smmlv, auxilio: e.tieneAuxilio !== false });
            }
        } catch (e) { /* sin datos anteriores */ }

        if (!estado.empleados.length) estado.empleados.push({ id: nuevoId(), nombre: 'Empleado 1', salario: smmlv, auxilio: true });
        estado.actual = estado.empleados[0].id;
        guardar();
    }

    const empleado = () => estado.empleados.find((e) => e.id === estado.actual) || estado.empleados[0];
    const turnosDe = (id) => estado.turnos[id] || (estado.turnos[id] = {});

    // ---------- Periodo ----------

    function fechasQuincena() {
        const [a, m] = estado.mes.split('-').map(Number);
        const ultimo = new Date(a, m, 0).getDate();
        const [ini, fin] = estado.quincena === 1 ? [1, 15] : [16, ultimo];
        const lista = [];
        for (let d = ini; d <= fin; d++) lista.push(`${estado.mes}-${String(d).padStart(2, '0')}`);
        return lista;
    }

    function turnosQuincena() {
        const t = turnosDe(empleado().id);
        return fechasQuincena().map((f) => ({ fecha: f, ...(t[f] || {}) }));
    }

    // ---------- Paso 1: empleado y reglas de la quincena ----------

    function pintarEmpleado() {
        const sel = $('empleadoSelect');
        sel.innerHTML = estado.empleados.map((e) => `<option value="${e.id}">${escapar(e.nombre || 'Sin nombre')}</option>`).join('');
        sel.value = empleado().id;
        $('nombre').value = empleado().nombre;
        $('salario').value = empleado().salario;
        $('auxilio').checked = empleado().auxilio;
        $('mes').value = estado.mes;
        $('quincena').value = String(estado.quincena);
        $('btnEliminar').disabled = estado.empleados.length < 2;
    }

    // Primer día de la quincena en que una regla cambia, si cambia.
    function cambioEn(fechas, lector) {
        const inicial = lector(M.reglasEn(fechas[0]));
        const f = fechas.find((x) => lector(M.reglasEn(x)) !== inicial);
        return f || null;
    }

    function pintarReglasQuincena() {
        const fechas = fechasQuincena();
        const r = M.reglasEn(fechas[0]);
        const salario = Number(empleado().salario) || 0;
        const tarjeta = (valor, etiqueta, cambio, nuevo) => `
            <div class="nom-regla"><b>${valor}</b><span>${etiqueta}</span>
            ${cambio ? `<span class="nom-cambio">Desde el ${fecha(cambio)}: ${nuevo}</span>` : ''}</div>`;

        const cJornada = cambioEn(fechas, (x) => x.jornada);
        const cDominical = cambioEn(fechas, (x) => x.dominical);
        const cNocturno = cambioEn(fechas, (x) => x.inicioNocturno);
        const rJ = cJornada && M.reglasEn(cJornada), rD = cDominical && M.reglasEn(cDominical), rN = cNocturno && M.reglasEn(cNocturno);

        $('reglasQuincena').innerHTML =
            tarjeta(dinero(salario / r.divisor), `valor hora · jornada de ${r.jornada} h (÷ ${r.divisor})`,
                cJornada, rJ && `${rJ.jornada} h, hora a ${dinero(salario / rJ.divisor)}`) +
            tarjeta(pct(r.dominical), 'recargo dominical y festivo', cDominical, rD && pct(rD.dominical)) +
            tarjeta(`${r.inicioNocturno - 12} p. m. – 6 a. m.`, `jornada nocturna · recargo ${pct(r.recargoNocturno)}`,
                cNocturno, rN && `desde las ${rN.inicioNocturno - 12} p. m.`) +
            tarjeta(dinero(r.smmlv), `salario mínimo ${fechas[0].slice(0, 4)}${r.minimosExactos ? '' : ' (último publicado)'}`) +
            tarjeta(dinero(r.auxilio), 'auxilio de transporte mensual');
    }

    // ---------- Paso 2: tabla de turnos ----------

    function pintarTabla() {
        const filas = turnosQuincena().map((t) => {
            const ds = M.diaSemana(t.fecha);
            const descanso = M.diaDeDescanso(t.fecha);
            return `<tr data-fecha="${t.fecha}" class="${descanso ? 'es-descanso' : ''}">
                <td><span class="nom-dia">${DIAS[ds]} ${Number(t.fecha.slice(8))}</span>
                    <span class="nom-dia-fecha">${fecha(t.fecha)}</span>
                    ${descanso ? `<span class="nom-etiqueta-dia">${escapar(descanso)}</span>` : ''}</td>
                <td data-etiqueta="Entrada"><input type="time" class="t-entrada" value="${t.entrada || ''}" aria-label="Entrada del ${fecha(t.fecha)}"></td>
                <td data-etiqueta="Salida"><input type="time" class="t-salida" value="${t.salida || ''}" aria-label="Salida del ${fecha(t.fecha)}"></td>
                <td class="nom-num-celda t-horas" data-etiqueta="Horas"></td>
                <td class="nom-num-celda t-noct" data-etiqueta="Nocturnas"></td>
                <td class="nom-num-celda t-fest" data-etiqueta="Dom. y fest."></td>
            </tr>`;
        });
        $('turnosBody').innerHTML = filas.join('');
    }

    function celda(td, valor) {
        td.textContent = valor ? horas(valor) : '—';
        td.classList.toggle('nom-cero', !valor);
    }

    function actualizarFilas() {
        const salario = Number(empleado().salario) || 0;
        let tH = 0, tN = 0, tF = 0;
        for (const tr of $('turnosBody').rows) {
            const entrada = tr.querySelector('.t-entrada').value, salida = tr.querySelector('.t-salida').value;
            let h = 0, n = 0, f = 0;
            if (entrada && salida && entrada !== salida) {
                const d = M.desglosarTurno({ fecha: tr.dataset.fecha, entrada, salida }, salario);
                h = d.minutos / 60; n = d.nocturnos / 60; f = d.festivos / 60;
            }
            celda(tr.querySelector('.t-horas'), h);
            celda(tr.querySelector('.t-noct'), n);
            celda(tr.querySelector('.t-fest'), f);
            tH += h; tN += n; tF += f;
        }
        $('totHoras').textContent = horas(tH);
        $('totNocturnas').textContent = horas(tN);
        $('totFestivas').textContent = horas(tF);
    }

    // ---------- Paso 3: desprendible ----------

    let documentoActual = null;

    function armarDocumento() {
        const e = empleado();
        const fechas = fechasQuincena();
        const r = M.liquidarQuincena({ salario: Number(e.salario) || 0, conAuxilio: e.auxilio, turnos: turnosQuincena(), desde: fechas[0] });

        const devengados = [['Salario básico quincenal', 'Salario mensual ÷ 2', r.basico]];
        if (r.auxilio) devengados.push(['Auxilio de transporte', `${dinero(r.minimos.auxilio)} ÷ 2 · ${r.minimos.norma}`, r.auxilio]);
        for (const x of r.recargos) {
            const nombre = x.tipo === 'nocturno' ? 'Recargo nocturno' : 'Recargo dominical y festivo';
            devengados.push([nombre, `${horas(x.horas)} h × ${pct(x.tasa)} · ${x.norma}`, x.valor]);
        }

        const base = r.devengado - r.auxilio;
        const deducciones = [
            ['Salud', `4 % de ${dinero(base)}`, r.salud],
            ['Pensión', `4 % de ${dinero(base)}`, r.pension]
        ];
        if (r.solidaridad) deducciones.push(['Fondo de solidaridad pensional', `${pct(r.tasaSolidaridad)} de ${dinero(base)}`, r.solidaridad]);

        return {
            empleado: e.nombre || 'Sin nombre', empleadoId: e.id, mes: estado.mes, quincena: estado.quincena,
            desde: fechas[0], hasta: fechas[fechas.length - 1], horas: r.horas,
            devengados, deducciones, totalDevengado: r.devengado, totalDeducciones: r.deducciones, neto: r.neto,
            avisos: r.avisos
        };
    }

    function lineas(lista, total, etiquetaTotal) {
        return lista.map(([c, d, v]) => `
            <div class="nom-linea"><span>${escapar(c)}<small>${escapar(d)}</small></span><span class="nom-valor">${dinero(v)}</span></div>`).join('') +
            `<div class="nom-linea nom-total"><span>${etiquetaTotal}</span><span class="nom-valor">${dinero(total)}</span></div>`;
    }

    function pintarDesprendible() {
        const doc = documentoActual = armarDocumento();
        $('resumenPeriodo').textContent =
            `${doc.empleado} · del ${fecha(doc.desde)} al ${fecha(doc.hasta)} · ${horas(doc.horas.total)} h trabajadas, ` +
            `${horas(doc.horas.nocturnas)} nocturnas y ${horas(doc.horas.festivas)} en domingo o festivo.`;
        $('devengados').innerHTML = lineas(doc.devengados, doc.totalDevengado, 'Total devengado');
        $('deducciones').innerHTML = lineas(doc.deducciones, doc.totalDeducciones, 'Total deducciones');
        $('neto').textContent = dinero(doc.neto);
        const avisos = $('avisos');
        avisos.hidden = !doc.avisos.length;
        avisos.innerHTML = doc.avisos.map((a) => `<li>${escapar(a)}</li>`).join('');
    }

    function recalcular() {
        actualizarFilas();
        pintarDesprendible();
    }

    function pintarTodo() {
        pintarEmpleado();
        pintarReglasQuincena();
        pintarTabla();
        recalcular();
        pintarHistorial();
    }

    // ---------- Tabla de reglas (sale de los mismos tramos del motor) ----------

    function pintarTablaReglas() {
        const t = M.tramos;
        const vigencia = (lista, texto) => lista.map((x, i) => {
            const sig = lista[i + 1];
            if (x.desde === '0000-01-01') return `${texto(x)} hasta el ${fecha(M.sumarDias(sig.desde, -1))}`;
            return `${texto(x)} desde el ${fecha(x.desde)}`;
        });
        const desde2025 = (lista) => lista.filter((x, i) => !lista[i + 1] || lista[i + 1].desde >= '2025-07-01');

        const filas = [
            ['Jornada máxima semanal y divisor de la hora',
                vigencia(desde2025(t.JORNADA).filter((x) => x.desde !== '0000-01-01'), (x) => `${x.horas} h (÷ ${x.horas * 5})`), 'Ley 2101 de 2021'],
            ['Recargo dominical y festivo', vigencia(t.DOMINICAL, (x) => pct(x.tasa)), 'Ley 2466 de 2025'],
            ['Jornada nocturna, con recargo del 35 %', vigencia(t.NOCTURNO, (x) => `De ${x.inicio - 12} p. m. a 6 a. m.`),
                'Código Sustantivo del Trabajo, arts. 160 y 168, modificados por la Ley 2466 de 2025'],
            ['Salario mínimo y auxilio de transporte', Object.entries(t.MINIMOS).map(([a, m]) => `${a}: ${dinero(m.smmlv)} y ${dinero(m.auxilio)}`),
                Object.entries(t.MINIMOS).map(([a, m]) => `${a}: ${m.norma}`).join(' · ')],
            ['Auxilio de transporte', ['Para salarios de hasta 2 SMMLV; no entra en la base de salud y pensión'], 'Ley 15 de 1959'],
            ['Salud y pensión del trabajador', ['4 % y 4 % de lo devengado sin el auxilio'], 'Ley 100 de 1993'],
            ['Fondo de solidaridad pensional', ['1 % desde 4 SMMLV, hasta 2 % desde 20 SMMLV'], 'Ley 100 de 1993, art. 27'],
            ['Festivos', ['Se calculan para cualquier año: fijos, trasladados al lunes y móviles según la Pascua'], 'Ley 51 de 1983']
        ];
        $('tablaReglas').innerHTML = filas.map(([regla, valores, norma]) =>
            `<tr><td>${regla}</td><td>${valores.map(escapar).join('<br>')}</td><td>${escapar(norma)}</td></tr>`).join('');
    }

    // ---------- Historial ----------

    function pintarHistorial() {
        const ul = $('historial');
        if (!estado.historial.length) {
            ul.innerHTML = '<li class="nom-vacio">Todavía no has guardado cálculos. Quedan solo en este navegador.</li>';
            return;
        }
        ul.innerHTML = estado.historial.map((h) => `
            <li>
                <span><strong>${escapar(h.empleado)}</strong> · ${dinero(h.neto)}
                    <small>Del ${fecha(h.desde)} al ${fecha(h.hasta)} · guardado el ${new Date(h.guardado).toLocaleString('es-CO')}</small></span>
                <span class="nom-botones">
                    <button type="button" class="nom-btn-chico" data-accion="abrir" data-id="${h.id}">Abrir</button>
                    <button type="button" class="nom-btn-chico" data-accion="pdf" data-id="${h.id}">PDF</button>
                    <button type="button" class="nom-btn-chico" data-accion="quitar" data-id="${h.id}">Quitar</button>
                </span>
            </li>`).join('');
    }

    // ---------- PDF ----------

    function descargarPdf(doc) {
        if (!window.jspdf) {
            alert('No se pudo cargar el generador de PDF. Revisa la conexión e inténtalo de nuevo.');
            return;
        }
        const pdf = new window.jspdf.jsPDF();
        const filas = (lista) => lista.map(([c, d, v]) => [c, d, dinero(v)]);

        pdf.setFontSize(18);
        pdf.setTextColor(229, 72, 77);
        pdf.text('Desprendible de pago', 20, 22);
        pdf.setFontSize(10);
        pdf.setTextColor(40, 40, 40);
        pdf.text(`Empleado: ${doc.empleado}`, 20, 32);
        pdf.text(`Periodo: del ${fecha(doc.desde)} al ${fecha(doc.hasta)}`, 20, 38);
        pdf.text(`Horas: ${horas(doc.horas.total)} en total · ${horas(doc.horas.nocturnas)} nocturnas · ${horas(doc.horas.festivas)} en domingo o festivo`, 20, 44);

        const estilo = { theme: 'grid', styles: { fontSize: 9 }, columnStyles: { 0: { cellWidth: 55 }, 2: { halign: 'right', cellWidth: 32 } } };
        pdf.autoTable({
            ...estilo, startY: 52, headStyles: { fillColor: [229, 72, 77] },
            head: [['Devengados', 'Detalle', 'Valor']],
            body: filas(doc.devengados),
            foot: [['Total devengado', '', dinero(doc.totalDevengado)]], footStyles: { fillColor: [235, 235, 235], textColor: 20 }
        });
        pdf.autoTable({
            ...estilo, startY: pdf.lastAutoTable.finalY + 8, headStyles: { fillColor: [60, 60, 66] },
            head: [['Deducciones', 'Detalle', 'Valor']],
            body: filas(doc.deducciones),
            foot: [['Total deducciones', '', dinero(doc.totalDeducciones)]], footStyles: { fillColor: [235, 235, 235], textColor: 20 }
        });

        let y = pdf.lastAutoTable.finalY + 12;
        pdf.setFillColor(229, 72, 77);
        pdf.rect(20, y, 170, 14, 'F');
        pdf.setFontSize(13);
        pdf.setTextColor(255, 255, 255);
        pdf.text('Neto a pagar', 25, y + 9.5);
        pdf.text(dinero(doc.neto), 185, y + 9.5, { align: 'right' });

        y += 24;
        pdf.setFontSize(8.5);
        pdf.setTextColor(110, 110, 110);
        for (const aviso of doc.avisos) {
            const partes = pdf.splitTextToSize(`Aviso: ${aviso}`, 170);
            pdf.text(partes, 20, y);
            y += partes.length * 4.5;
        }
        pdf.text('Cálculo orientativo con la regla vigente en cada fecha · carlosmhernandezv.com/nomina.html', 105, 285, { align: 'center' });

        pdf.save(`Desprendible_${doc.empleado.replace(/\s+/g, '_')}_${doc.desde}.pdf`);
    }

    // ---------- Ejemplo ----------

    function cargarEjemplo() {
        const nombre = 'Laura Gómez (ejemplo)';
        let e = estado.empleados.find((x) => x.nombre === nombre);
        if (!e) {
            e = { id: nuevoId(), nombre, salario: 1750905, auxilio: true };
            estado.empleados.push(e);
        }
        Object.assign(e, { salario: 1750905, auxilio: true });
        estado.actual = e.id;
        estado.mes = '2026-07';
        estado.quincena = 2;
        // Segunda quincena de julio de 2026: el domingo 19, el festivo del lunes 20 y el domingo 26,
        // un turno que cruza al domingo y cuatro noches seguidas. Jornada de 42 h y dominical al 90 %.
        const turnos = {
            '2026-07-16': ['14:00', '21:00'], '2026-07-17': ['14:00', '21:00'], '2026-07-18': ['23:00', '06:00'],
            '2026-07-20': ['07:00', '14:00'], '2026-07-21': ['07:00', '14:00'], '2026-07-22': ['07:00', '14:00'],
            '2026-07-24': ['15:00', '22:00'], '2026-07-25': ['15:00', '22:00'], '2026-07-26': ['08:00', '15:00'],
            '2026-07-28': ['22:00', '05:00'], '2026-07-29': ['22:00', '05:00'], '2026-07-30': ['22:00', '05:00'],
            '2026-07-31': ['22:00', '05:00']
        };
        const t = turnosDe(e.id);
        for (const f of fechasQuincena()) delete t[f];
        for (const [f, [entrada, salida]] of Object.entries(turnos)) t[f] = { entrada, salida };
        guardar();
        pintarTodo();
        $('t-paso3').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ---------- Eventos ----------

    function conectar() {
        $('empleadoSelect').addEventListener('change', (ev) => { estado.actual = ev.target.value; guardar(); pintarTodo(); });
        $('btnAgregar').addEventListener('click', () => {
            const e = { id: nuevoId(), nombre: `Empleado ${estado.empleados.length + 1}`, salario: M.reglasEn(fechasQuincena()[0]).smmlv, auxilio: true };
            estado.empleados.push(e);
            estado.actual = e.id;
            guardar();
            pintarTodo();
            $('nombre').select();
        });
        $('btnEliminar').addEventListener('click', () => {
            if (estado.empleados.length < 2) return;
            const e = empleado();
            if (!confirm(`¿Eliminar a ${e.nombre} y sus turnos?`)) return;
            estado.empleados = estado.empleados.filter((x) => x.id !== e.id);
            delete estado.turnos[e.id];
            estado.actual = estado.empleados[0].id;
            guardar();
            pintarTodo();
        });
        $('nombre').addEventListener('input', (ev) => {
            empleado().nombre = ev.target.value;
            $('empleadoSelect').selectedOptions[0].textContent = ev.target.value || 'Sin nombre';
            guardar();
            pintarDesprendible();
        });
        $('salario').addEventListener('input', (ev) => { empleado().salario = Number(ev.target.value) || 0; guardar(); pintarReglasQuincena(); recalcular(); });
        $('auxilio').addEventListener('change', (ev) => { empleado().auxilio = ev.target.checked; guardar(); recalcular(); });
        $('mes').addEventListener('change', (ev) => {
            if (!/^\d{4}-\d{2}$/.test(ev.target.value)) return;
            estado.mes = ev.target.value; guardar(); pintarTodo();
        });
        $('quincena').addEventListener('change', (ev) => { estado.quincena = Number(ev.target.value); guardar(); pintarTodo(); });

        $('turnosBody').addEventListener('change', (ev) => {
            const tr = ev.target.closest('tr');
            if (!tr) return;
            const entrada = tr.querySelector('.t-entrada').value, salida = tr.querySelector('.t-salida').value;
            const t = turnosDe(empleado().id);
            if (entrada || salida) t[tr.dataset.fecha] = { entrada, salida };
            else delete t[tr.dataset.fecha];
            guardar();
            recalcular();
        });

        $('btnRellenar').addEventListener('click', () => {
            const entrada = $('rellenoEntrada').value, salida = $('rellenoSalida').value;
            if (!entrada || !salida) return;
            const t = turnosDe(empleado().id);
            for (const f of fechasQuincena()) {
                if (M.diaSemana(f) !== 0 && !M.festivo(f) && !(t[f] && t[f].entrada)) t[f] = { entrada, salida };
            }
            guardar();
            pintarTabla();
            recalcular();
        });
        $('btnVaciar').addEventListener('click', () => {
            if (!confirm('¿Borrar los turnos de esta quincena?')) return;
            const t = turnosDe(empleado().id);
            for (const f of fechasQuincena()) delete t[f];
            guardar();
            pintarTabla();
            recalcular();
        });

        $('btnEjemplo').addEventListener('click', cargarEjemplo);
        $('btnPdf').addEventListener('click', () => descargarPdf(documentoActual));
        $('btnGuardar').addEventListener('click', () => {
            estado.historial.unshift({ id: nuevoId(), guardado: new Date().toISOString(), ...documentoActual });
            estado.historial = estado.historial.slice(0, 20);
            guardar();
            pintarHistorial();
            $('historial').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        $('historial').addEventListener('click', (ev) => {
            const btn = ev.target.closest('button[data-accion]');
            if (!btn) return;
            const h = estado.historial.find((x) => x.id === btn.dataset.id);
            if (!h) return;
            if (btn.dataset.accion === 'pdf') descargarPdf(h);
            if (btn.dataset.accion === 'quitar') {
                estado.historial = estado.historial.filter((x) => x.id !== h.id);
                guardar();
                pintarHistorial();
            }
            if (btn.dataset.accion === 'abrir' && estado.empleados.some((e) => e.id === h.empleadoId)) {
                Object.assign(estado, { actual: h.empleadoId, mes: h.mes, quincena: h.quincena });
                guardar();
                pintarTodo();
                $('t-paso3').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        iniciarEstado();
        pintarTablaReglas();
        conectar();
        // nomina.html#ejemplo abre la calculadora con el ejemplo cargado, para compartirla.
        if (location.hash === '#ejemplo') cargarEjemplo();
        else pintarTodo();
    });
})();
