# Entregable 4: Function Calling + multi-turn

## 1. ESTRUCTURA FINAL DEL PROYECTO

```text
openai-chat-api/
├── .env                         (existente, privado, sin modificar)
├── .gitignore                   (existente)
├── package.json
├── package-lock.json            (sin modificar)
├── server.js
├── test.http
├── README.md
├── verification-live.json       (evidencia generada por test:live)
├── verification-httpyac.json    (ejecución con el motor de la extensión)
├── src/
│   ├── app.js
│   ├── assistant.js
│   ├── conversations.js
│   ├── errors.js
│   ├── openai.js
│   ├── time.js
│   ├── tools.js
│   └── mocks/
│       ├── data.js
│       └── functions.js
├── scripts/
│   ├── verify-live.js
│   └── verify-httpyac.js
└── tests/
    ├── app.test.js
    └── http-file.test.js
```

Se omiten `.git/` y `node_modules/` del árbol.

## 2. ARCHIVOS CREADOS

| Archivo | Responsabilidad |
| --- | --- |
| `src/app.js` | Express, endpoints, validación HTTP y respuestas de error seguras. Permite inyectar el cliente para pruebas. |
| `src/assistant.js` | Orquesta Responses API y el ciclo de ejecución de tools; máximo seis interacciones por turno. |
| `src/conversations.js` | UUID por conversación, último response ID, caducidad y bloqueo de turnos simultáneos. |
| `src/errors.js` | Errores controlados con código HTTP y mensaje público. |
| `src/openai.js` | Cliente oficial, clave desde entorno, timeout de 30 segundos por intento y un reintento. |
| `src/time.js` | Calendario calculado con Node.js e instrucciones temporales/conversacionales. |
| `src/tools.js` | Cinco esquemas estrictos, lista permitida, validación y despacho a funciones. |
| `src/mocks/data.js` | Fixtures empresariales centralizados. |
| `src/mocks/functions.js` | Funciones existentes y `getProductProfits`, reemplazables por acceso a Tiendishop. |
| `tests/app.test.js` | Pruebas locales con `node:test`, HTTP real y cliente OpenAI controlado. No prueban la interpretación del modelo. |
| `scripts/verify-live.js` | Pruebas HTTP con OpenAI real y aserciones sobre tools, argumentos y conversaciones. Consume tokens. |
| `verification-live.json` | Resultado de la última ejecución real, respuestas y logs de demostración. |
| `scripts/verify-httpyac.js` | Ejecuta los siete pares de test.http con el motor incluido en la extensión local 6.16.7, OpenAI real y aserciones del protocolo. |
| `tests/http-file.test.js` | Impide nombres duplicados y referencias incompatibles con httpYac. |
| `verification-httpyac.json` | Evidencia de UUID, tools, fechas y call_id de los siete pares. |
| `README.md` | Reporte técnico e instrucciones reproducibles. |

## 3. ARCHIVOS MODIFICADOS

- `server.js`: pasó de unas 816 líneas a la inicialización de configuración, cliente, logs y servidor.
- `package.json`: entrada `server.js`; scripts `start`, `dev`, `test`, `test:live`. Sin nuevas dependencias ni actualización del SDK.
- `test.http`: conserva los requests anteriores, corrige separadores y agrega la sección **ENTREGABLE 4 - FUNCTION CALLING + MULTI-TURN**.

La implementación inicial y las modificaciones que ya estaban en `server.js` y `test.http` se revisaron antes de editar. `.env` no se reescribió ni se imprimió.

## 4. REFACTORIZACIÓN

Salieron de `server.js` los esquemas, mocks, funciones, validaciones HTTP, llamadas al modelo y ejecución de tools. Cada responsabilidad queda en un módulo CommonJS pequeño, sin frameworks nuevos ni microservicios.

Se conservaron `/chat` (conversación de texto), `/function` (con tools), `response` en el JSON y los nombres `getProfits`, `getBestSellingProduct`, `getWorstSellingProduct`, `getTopCustomer`.

Se corrigió un defecto previo: `getWorstSellingProduct` exigía que el modelo inventara el producto menos vendido y luego el dispatcher ni siquiera lo pasaba. Ahora recibe las fechas y obtiene el producto desde el mock. El nombre permanece igual.

## 5. FUNCTION CALLING

1. El usuario envía `message` y opcionalmente `conversationId`.
2. Express valida el request y obtiene/bloquea la conversación.
3. El backend envía mensaje, instrucciones temporales, historial enlazado y esquemas a Responses API.
4. OpenAI interpreta intención y produce `function_call` con nombre, argumentos y `call_id`.
5. El backend valida nombre permitido, JSON, campos, fechas reales y orden del rango; el producto debe ser texto no vacío cuando corresponde.
6. El backend ejecuta la función local, que obtiene datos mock.
7. Devuelve el JSON como `function_call_output` con el mismo `call_id` y enlaza la respuesta que solicitó la tool.
8. OpenAI redacta la respuesta. Si solicita más tools, se repite el ciclo dentro del límite.
9. Se guarda el ID de la respuesta final exitosa y se devuelve al cliente.

OpenAI no ejecuta funciones locales ni accede a una base de datos. Los esquemas estrictos complementan, pero no reemplazan, la validación del backend.

Errores: 400 para cuerpo/mensaje/UUID inválidos, 404 para conversación inexistente o expirada, 409 para turno simultáneo o endpoint distinto, 413 para body excesivo, 502 para error del proveedor o tool inválida, 503 para rate limit/capacidad temporal, 500 para fallo de ejecución local. No se devuelven stacks ni errores crudos del SDK.

## 6. MANEJO DEL AÑO

`new Date()` obtiene el instante real del sistema en cada turno. `Intl.DateTimeFormat` lo convierte a `APP_TIMEZONE`, por defecto `America/La_Paz`. El backend calcula hoy, ayer, mes actual/anterior y semana actual/anterior. No existe un año fijo en el código de producción.

Reglas enviadas en cada interacción:

- Año explícito: respetarlo, incluyendo 2024 o cualquier otro año válido.
- Mes/día sin año: año del servidor; un año establecido explícitamente en la conversación puede mantenerse cuando sigue siendo pertinente.
- Mes nombrado: mes completo; día nombrado: ese único día.
- Este mes: mes completo de calendario. Esta semana: desde el lunes hasta hoy. Si solicita explícitamente hasta hoy, el fin es hoy.
- Mes/semana pasado: periodo completo inmediatamente anterior al actual.
- “El anterior”: periodo anterior al que se venía consultando.
- Periodo omitido: reutilizar el del historial; sin contexto, solicitar aclaración.

El modelo interpreta el lenguaje y el backend valida fechas reales `YYYY-MM-DD` y `startDate <= endDate`. No hay detección de frases mediante if/else. Un año como 2023 es válido si el usuario lo solicita; lo que se evita mediante contexto temporal es asumirlo arbitrariamente. La interpretación semántica sigue dependiendo del modelo y se comprueba con pruebas reales.

## 7. MULTI-TURN

Primer request, sin identificador:

```json
{"message":"¿Cuál vendí más este mes?"}
```

El backend genera un UUID y devuelve:

```json
{"response":"...","conversationId":"UUID generado","responseId":"resp_..."}
```

Segundo request al mismo endpoint:

```json
{"message":"¿Y el que menos?","conversationId":"UUID generado"}
```

Un `Map` mantiene UUID → último response ID exitoso. El seguimiento lleva el ID al proveedor: el modelo recibe el contexto anterior, incluidos resultados de tools, y puede inferir intención, producto y fechas. No se simulan respuestas ni se interpretan frases manualmente.

Cada UUID tiene estado separado; omitirlo crea otra conversación. Hay un máximo de 1000 conversaciones y caducidad de una hora sin actividad, depurada al recibir requests. Reiniciar el proceso pierde el mapa. Un fallo conserva el último turno exitoso; una conversación nueva fallida se descarta. Un segundo request simultáneo al mismo UUID recibe 409. Las conversaciones de `/chat` y `/function` no se intercambian.

## 8. RESPONSE_ID / CONTINUIDAD

Se usa `previous_response_id` con `store: true`. Está soportado por el SDK **OpenAI 7.7.0 instalado**, verificado en `node_modules/openai/resources/responses/responses.d.ts`.

Tras una tool, se enlaza el ID de la respuesta que la solicitó. Entre turnos, se enlaza el ID de la respuesta final. Las instrucciones se reenvían porque no se heredan automáticamente al usar este mecanismo. `conversationId` es un UUID del backend; no es un objeto de Conversations API ni un response ID enviado por el usuario.

Es una solución sencilla para este POC; no requiere crear recursos de Conversations API. El backend controla qué cadena se continúa, y OpenAI mantiene las respuestas almacenadas. La memoria local no implica que el historial esté almacenado exclusivamente en el proceso.

Referencias oficiales consultadas:

- [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state)
- [Function calling](https://developers.openai.com/api/docs/guides/function-calling)

## 9. DATOS MOCK

| Consulta | Resultado simulado |
| --- | --- |
| Ganancia total | 1000, sin moneda definida |
| Producto más vendido | Leche PIL, 150 unidades |
| Producto menos vendido | Yogurt Natural, 20 unidades |
| Cliente con más compras | Juan Pérez, 25 compras |
| Ganancia de Yogurt Natural | 240 |
| Ganancia de Leche PIL | 600 |
| Producto desconocido | `found: false`, `profits: null`; no se inventa un importe |

Las fechas se reciben y se devuelven correctamente, pero los importes/cantidades son fixtures constantes: no se calculan ventas históricas. Las instrucciones piden indicar que son datos mock; el modelo puede omitir esa etiqueta en alguna respuesta, por lo que la demostración debe presentarse explícitamente como POC con datos simulados. `product` se extrae de la consulta o historial; no es un argumento fijo.

## 10. FUTURA INTEGRACIÓN CON TIENDISHOP

Sustituir las implementaciones de `src/mocks/functions.js` por consultas a la API o repositorio autorizado de Tiendishop, conservando los contratos de entrada/salida. El dispatcher ya espera resultados asíncronos. Definir entonces moneda, zona horaria del negocio y reglas contables reales.

La identidad del usuario y el negocio autorizado deberán provenir de autenticación del backend, nunca de un argumento inventado por el modelo. OpenAI sigue recibiendo únicamente los datos necesarios devueltos por las funciones; no necesita credenciales de Tiendishop ni acceso directo a su base de datos.

## 11. SEGUNDA LLAMADA A OPENAI

1. **¿Es obligatoria?** No para obtener el JSON o responder desde el backend. Sí se necesita otra interacción si se desea que el modelo procese el resultado y redacte la respuesta dentro de este flujo.
2. **Respuesta directa desde JSON:** permitiría una plantilla determinista y ahorrar esa interacción, pero habría que incorporar explícitamente el resultado al contexto antes de continuar la conversación.
3. **Por qué devolverlo:** el modelo convierte datos en lenguaje natural, integra varias tools y puede manejar resultados ausentes o aclaraciones.
4. **Multi-turn:** la respuesta final queda enlazada a la solicitud y al resultado de la tool. Un seguimiento puede reutilizar producto, intención y periodo con evidencia en el historial.
5. **Costos:** añade latencia, tokens de entrada/salida, dependencia del proveedor y otra posibilidad de fallo. El historial también aumenta el contexto procesado; `previous_response_id` no hace gratuitos los turnos anteriores.

Por estas razones se conserva el flujo original y se amplía para múltiples rondas acotadas.

## 12. PRUEBAS

**Verificación ejecutada el 26 de septiembre de 2026:** 9 pruebas locales aprobadas y 29 requests reales con OpenAI aprobados, sin fallos en la ejecución final. Se inició además `npm start` en el puerto 3000 y se comprobaron ambos endpoints. Sintaxis de todos los módulos y JSON de los 55 requests de `test.http` verificados. El servidor de comprobación se detuvo al finalizar; para la demostración ejecutar `npm start`.

La primera conexión quedó bloqueada por la red del entorno restringido; la verificación real se completó con acceso autorizado. Durante las pruebas se ajustó la regla de meses completos para eliminar una inconsistencia entre mes nombrado y mes actual. La evidencia final está en `verification-live.json`: tools, argumentos, resultados y cadenas de response IDs. Septiembre se ejecutó con el año 2026 obtenido del sistema, agosto de 2024 respetó 2024 y ninguna tool de esta batería recibió 2023 arbitrariamente.

Requisitos: Node.js compatible con el SDK (verificado con v24.19.0), dependencias instaladas y `OPENAI_API_KEY` en el `.env` existente. Opcionales: `PORT` (3000), `OPENAI_MODEL` (`gpt-4.1-mini`), `APP_TIMEZONE` (`America/La_Paz`). Ejecutar:

```sh
npm test
npm start
```

En VS Code con **httpYac - Rest Client 6.16.7** (`anweber.vscode-httpyac`), abrir `test.http`:

1. Ejecutar requests anteriores de `/chat` y `/function`; los mensajes sin periodo pueden pedir aclaración.
2. En **ENTREGABLE 4**, ejecutar **A → B → C → D → E**.
3. Ejecutar **MULTI-TURN 1: Turno 1 → Turno 2**; observar best → worst con mismas fechas.
4. Ejecutar **MULTI-TURN 2: Turno 1 → Turno 2**; observar top customer en septiembre → agosto, mismo año.
5. Ejecutar **MULTI-TURN 3: Turno 1 → Turno 2**; observar ganancias mes actual → mes pasado.
6. Ejecutar **MULTI-TURN 4: Turno 1 → Turno 2**; observar `getProductProfits`, mismo `product`, fechas nuevas.
7. Ejecutar pruebas adicionales de hoy/semanas/día sin año, aclaraciones, otro producto y producto desconocido.
8. Ejecutar los errores: se espera 400 sin llamadas a OpenAI.

Las expresiones `{{multi1.conversationId}}` (multi1 a multi7), junto con `# @ref multi1`, reutilizan el JSON del request nombrado por `# @name multi1`. httpYac ejecuta el primer turno si no tiene una respuesta en caché. Los nombres son únicos, incluidos los ejemplos adicionales multi5 a multi7. Tras reiniciar el servidor o expirar la conversación, ejecutar nuevamente turno 1 o usar Reset de httpYac.

| Prueba | Tool / argumentos esperados |
| --- | --- |
| A | `getTopCustomer`: septiembre del año actual del servidor |
| B | `getTopCustomer`: 2024-08-01 a 2024-08-31 |
| C | `getBestSellingProduct`: primer a último día del mes actual |
| D | `getProfits`: ayer a ayer |
| E | `getProductProfits`: Yogurt Natural + mes actual completo |

Logs JSON de desarrollo: `consulta` (mensaje, UUID, ID previo, calendario), `respuesta_openai` (IDs de continuidad), `tool_ejecutada` (nombre, argumentos, fechas y resultado). En el segundo turno, `previous_response_id` debe coincidir con el `responseId` final del primero. Los errores del SDK registran únicamente código HTTP, nunca su objeto completo. Usar solamente consultas sintéticas de demostración en estos logs; `NODE_ENV=production` desactiva el detalle.

Para repetir automáticamente las pruebas reales, sin iniciar otro servidor manual:

```sh
npm run test:live
```

El script inicia Express en un puerto local libre, usa OpenAI real, comprueba los argumentos, intercala conversaciones y guarda `verification-live.json`. No usa respuestas hardcodeadas para la prueba real. Las pruebas locales sí inyectan un cliente controlado para comprobar errores y protocolo sin costo.

Durante esta revisión, una ejecución obtuvo 28/29: el modelo asumió un periodo en la consulta sin fechas «¿Qué producto vendí más?». Se reforzó la condición de periodo en las instrucciones y en las descripciones de tools; no se añadieron detectores manuales de frases. El resultado final posterior se registra en verification-live.json.

### Compatibilidad comprobada con el cliente instalado

La extensión instalada es **httpYac - Rest Client 6.16.7**, no REST Client de Huachao Mao. La sintaxis anterior `multi1.response.body.$.conversationId` no corresponde a este motor. También existían nombres multi1–3 duplicados en el bloque adicional; ahora se llaman multi5–7, conservando sus consultas.

Sintaxis final:

```http
### Turno 1
# @name multi1
POST http://localhost:3000/function
Content-Type: application/json

{"message":"¿Cuál vendí más este mes?"}

### Turno 2
# @name multi1FollowUp
# @ref multi1
POST http://localhost:3000/function
Content-Type: application/json

{"message":"¿Y el que menos?","conversationId":"{{multi1.conversationId}}"}
```

Ejecutar turno 1 y luego turno 2 con **Send Request de httpYac**. `@ref` también ejecuta el turno 1 automáticamente si no existe respuesta cacheada. Después de reiniciar el backend, repetir turno 1 o utilizar Reset de httpYac para descartar UUID anteriores. No usar Send All para la demostración: el archivo también contiene errores intencionales.

Se ejecutaron los siete segundos turnos con caché inicialmente vacía, utilizando el parser, el resolvedor de variables y el cliente HTTP del motor realmente incluido en la extensión instalada. Se verificaron 14 requests a Express/OpenAI: mismo UUID por pareja, continuidad, tools, argumentos y correspondencia de call_id. No se simularon las sustituciones con una expresión regular. No se automatizaron clics en la interfaz de VS Code.

Para reproducir esa comprobación:

```sh
node scripts/verify-httpyac.js "RUTA_A_LA_EXTENSION/anweber.vscode-httpyac-6.16.7"
```

Este comprobador carga en memoria el motor del bundle instalado antes de su adaptador de interfaz de VS Code; no modifica la extensión ni añade dependencias al proyecto. Es específico del bundle 6.16.7 y falla explícitamente ante otra versión. Usa un puerto local libre y guarda `verification-httpyac.json`. Consume tokens.

Documentación oficial: [nombres y referencias de httpYac](https://httpyac.github.io/guide/metaData.html#name).

## 13. LIMITACIONES DEL POC/MVP

- Mocks constantes; no hay ventas ni base de datos reales.
- Almacenamiento local temporal, un solo proceso y limpieza al recibir tráfico.
- Sin autenticación ni autorización por negocio: el UUID no sustituye identidad; no exponer el prototipo públicamente.
- Continuidad dependiente de disponibilidad/retención de respuestas de OpenAI. Una cadena expirada requiere iniciar otra conversación.
- Sin compactación de conversaciones extensas ni presupuesto acumulado de tokens.
- El lenguaje natural es probabilístico: una prueba exitosa no garantiza todas las formulaciones futuras.
- Límite de seis interacciones por turno; sin streaming, observabilidad de producción ni rate limiting por usuario.
- Logs y archivo de evidencia son para datos sintéticos; no utilizar información personal real durante esta demostración.

## 14. EXPLICACIÓN PARA MI SUPERVISOR

“Separé el servidor en módulos para HTTP, conversación, tools, fechas y mocks, conservando los endpoints y funciones que ya tenía. El backend calcula la fecha actual del sistema y la envía en cada interacción; así el modelo tiene una referencia explícita para septiembre, ayer o mes pasado. Cada conversación tiene un UUID que apunta a la última respuesta de OpenAI. Cuando pregunto ‘¿y el que menos?’, el modelo recibe el historial y selecciona la nueva tool con el periodo anterior. OpenAI propone la llamada; mi backend valida y ejecuta la función. Devuelvo el JSON al modelo para que responda naturalmente y ese resultado también forme parte del historial. Los datos siguen siendo mock porque estamos validando el POC. Para Tiendishop reemplazaré las funciones de datos por consultas autorizadas, manteniendo este mismo flujo.”





