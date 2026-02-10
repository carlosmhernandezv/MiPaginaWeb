# CONTEXTO DEL PROYECTO: SISTEMA DE LIQUIDACIÓN DE NÓMINA WEB (COLOMBIA 2026)

## 1. VISIÓN DEL PRODUCTO
Estamos construyendo una herramienta web profesional dentro de mi portafolio personal. El objetivo principal es una **Calculadora de Nómina Quincenal** altamente precisa, adaptada a la legislación colombiana vigente (2026), capaz de manejar turnos rotativos, recargos nocturnos y dominicales.

**Usuario Objetivo:** Pequeños empresarios (restaurantes, franquicias) y empleados que desean verificar sus pagos.
**Caso de Uso Principal:** Un administrador ingresa los turnos de un empleado (Sushiman) y el sistema devuelve el desprendible de pago exacto.

## 2. REGLAS DE NEGOCIO (EL CORAZÓN DEL SISTEMA)
El sistema NO PUEDE inventar reglas. Debe regirse estrictamente por la siguiente lógica jurídica:

### A. Constantes Legales (Año 2026)
* **Salario Mínimo (SMMLV):** $1.750.905 COP.
* **Auxilio de Transporte:** $249.095 COP (Se paga si Salario < 2 SMMLV).
* **Jornada Laboral:** Transición de 44 a 42 horas en Julio 2026.

### B. Lógica de Recargos (Crítico)
El sistema debe detectar automáticamente los recargos basándose en la hora de entrada y salida:
1.  **Recargo Nocturno (35%):** Horas trabajadas entre 9:00 PM y 6:00 AM.
2.  **Dominical/Festivo (75%):** Horas trabajadas en día domingo o festivo.
3.  **Extras:** Solo si superan la jornada máxima semanal (44 horas).

### C. Algoritmo de Liquidación
`Neto a Pagar = (Básico + Auxilio + Recargos) - (Salud 4% + Pensión 4%)`
* *Nota:* Salud y Pensión se calculan sobre el `Total Devengado` MENOS el `Auxilio de Transporte`.

## 3. ESPECIFICACIONES TÉCNICAS (STACK)
* **Lenguaje:** Python (Backend).
* **Framework Web:** Antigravity / Flask / Streamlit (según implementación).
* **Integración IA:** Uso de MCP (Model Context Protocol) o Gemini API para procesar reglas complejas.
* **Formato de Datos:** JSON para el intercambio entre Frontend y Lógica.

## 4. DISEÑO DE LA INTERFAZ (UI/UX)
La interfaz debe ser limpia, "tipo abogado" pero moderna.

### Sección 1: Configuración del Empleado
* Input: Salario Básico Mensual (Campo numérico).
* Toggle: ¿Tiene Auxilio de Transporte? (Sí/No).
* Select: Periodo a Liquidar (Quincena 1 / Quincena 2).

### Sección 2: La Sábana de Turnos (Grid)
Necesitamos una grilla o tabla dinámica donde el usuario ingrese día por día:
* [Fecha] | [Hora Entrada] | [Hora Salida] | [¿Es Descanso?] | [¿Hubo Novedad?]
* *Requisito:* El sistema debe calcular automáticamente las horas totales de esa fila.

### Sección 3: El Resultado (Output Visual)
No mostrar solo un número. Mostrar un **Desprendible de Pago** digital:
* Columna Izquierda: Devengados (Básico, Recargos detallados, Auxilio).
* Columna Derecha: Deducciones (Salud, Pensión, Préstamos).
* **Footer:** GRAN TOTAL NETO A PAGAR (En verde y negrita).

## 5. ESTRUCTURA DE ARCHIVOS SUGERIDA
/proyecto_nomina
│── app.py                # Lógica principal de Antigravity/Web
│── calculos_nomina.py    # Funciones puras de Python (Matemáticas)
│── fuentes_legales/      # AQUÍ VIVE LA INTELIGENCIA
│   ├── 01_Marco_Legal_2026.txt
│   ├── 02_Logica_Calculo_CST.txt
│   └── 03_Plantilla_Universal.txt
│── templates/            # HTML/CSS
└── CONTEXTO_PROYECTO.md  # Este archivo

## 6. INSTRUCCIONES PARA LA IA (ANTIGRAVITY)
1.  Cuando te pida "generar el código del cálculo", ve a leer `calculos_nomina.py` y asegúrate de que cumpla con `02_Logica_Calculo_CST.txt`.
2.  No uses librerías externas complejas para la lógica de negocio, usa Python puro para transparencia.
3.  Si hay duda sobre un festivo, asume que el usuario debe marcar manualmente si el día es festivo en la interfaz.