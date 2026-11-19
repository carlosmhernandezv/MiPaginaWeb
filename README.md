# Portafolio y calculadora de nómina

[![Pruebas](https://github.com/carlosmhernandezv/MiPaginaWeb/actions/workflows/pruebas.yml/badge.svg)](https://github.com/carlosmhernandezv/MiPaginaWeb/actions/workflows/pruebas.yml)

Código de [carlosmhernandezv.com](https://carlosmhernandezv.com): mi portafolio como analista funcional técnico
y una calculadora de nómina quincenal para Colombia que cualquiera puede probar.

- **Sitio:** <https://carlosmhernandezv.com>
- **Calculadora con un ejemplo cargado:** <https://carlosmhernandezv.com/nomina.html#ejemplo>

## Qué hay aquí

| Ruta | Qué es |
|---|---|
| `index.html` | Portada: proyectos, capacidades y contacto |
| `caso-cfdi.html` | Caso de estudio: trazabilidad documental y CFDI (México) |
| `caso-micomercializadora.html` | Caso de estudio: plataforma B2B con facturación DIAN (Colombia) |
| `nomina.html`, `css/nomina.css` | Interfaz de la calculadora de nómina |
| `js/nomina-motor.js` | Motor de cálculo, sin interfaz |
| `js/nomina-app.js` | Lee los campos, guarda en el navegador y pinta el resultado |
| `tests/nomina-motor.test.js` | Pruebas del motor |
| `docs/cv.html` | Fuente de la hoja de vida; el PDF se genera desde aquí |

El sitio es HTML, CSS y JavaScript sin dependencias ni paso de compilación. El código de los sistemas que
describen los casos de estudio es privado.

## La calculadora de nómina

Liquida una quincena a partir de los turnos de un empleado: salario básico, auxilio de transporte, recargo
nocturno, recargo dominical y festivo, salud, pensión y fondo de solidaridad.

### Decisiones de diseño

- **Las reglas tienen fecha.** Entre 2025 y 2027 la jornada, el recargo dominical y la hora nocturna cambian a
  mitad de año. Cada regla es una lista de tramos con su fecha de inicio y su norma, y cada minuto trabajado se
  liquida con el tramo vigente en ese minuto. Una quincena que cruza un cambio sale bien sin casos especiales.
- **El motor no conoce la interfaz.** `nomina-motor.js` recibe salario y turnos y devuelve el desprendible. Por
  eso se prueba con Node, sin navegador.
- **La tabla de reglas que ve el usuario sale de los mismos tramos que usa el cálculo.** No hay una copia del
  marco legal en el texto de la página que pueda quedar desactualizada.
- **Los festivos se calculan.** Fijos, trasladados al lunes y móviles según la Pascua, para cualquier año.
- **Dice lo que no calcula.** Horas extra, prima, cesantías, vacaciones y retención quedan fuera; cuando una
  semana supera la jornada máxima la calculadora avisa.

### Reglas que aplica

| Regla | Valor y vigencia | Norma |
|---|---|---|
| Jornada semanal y divisor de la hora | 44 h (÷ 220) desde el 15/07/2025 · 42 h (÷ 210) desde el 15/07/2026 | Ley 2101 de 2021 |
| Recargo dominical y festivo | 80 % desde el 01/07/2025 · 90 % desde el 01/07/2026 · 100 % desde el 01/07/2027 | Ley 2466 de 2025 |
| Jornada nocturna (recargo del 35 %) | De 7 p. m. a 6 a. m. desde el 25/12/2025 | Ley 2466 de 2025 |
| Salario mínimo y auxilio de transporte 2026 | $ 1.750.905 y $ 249.095 | Decretos 1469 y 1470 de 2025 |
| Salud y pensión del trabajador | 4 % y 4 % de lo devengado sin el auxilio | Ley 100 de 1993 |
| Festivos | Calculados para cualquier año | Ley 51 de 1983 |

Es una herramienta orientativa: no reemplaza una liquidación oficial ni asesoría laboral.

## Pruebas

Requiere Node 20 o superior. No hay nada que instalar.

```bash
node --test tests/nomina-motor.test.js
```

Las pruebas cubren los cambios de tramo, el turno que cruza de sábado a domingo, la hora nocturna, el auxilio de
transporte, el fondo de solidaridad y los festivos de 2026 contra el calendario oficial. Se ejecutan en cada
cambio con GitHub Actions.

## Verlo en local

Cualquier servidor de archivos estáticos sirve:

```bash
npx serve .
```

## Licencia

El código (HTML, CSS y JavaScript) se publica bajo la licencia MIT; ver [LICENSE](LICENSE). Los textos, las
imágenes, las capturas y la hoja de vida no forman parte de esa licencia.
