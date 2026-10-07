# OpenAI Chat API

Servidor Node.js con Express para interactuar con OpenAI Responses API, conservar conversaciones y ejecutar Function Calling con persistencia real en PostgreSQL.

## 1. Descripción

Este proyecto implementa un backend HTTP para conversaciones con OpenAI en un flujo multiturno. La API acepta mensajes de usuario, mantiene un identificador de conversación, reutiliza el contexto previo y, cuando corresponde, ejecuta herramientas definidas en el servidor antes de devolver una respuesta final.

La parte central del Entregable 5 es la integración con PostgreSQL para registrar conversaciones y recuperar su estado, evitando depender exclusivamente de la memoria del proceso. La aplicación mantiene el flujo existente de Function Calling y conserva la lógica temporal del proyecto original, pero añade persistencia real para continuidad, reinicio y restauración.

## 2. Tecnologías

Las tecnologías realmente presentes en el proyecto son:

- Node.js
- Express
- OpenAI Responses API
- Function Calling
- PostgreSQL
- pg
- dotenv
- Node test runner (`node:test`)
- Scripts de validación y prueba del proyecto

No se incorporan tecnologías adicionales ni servicios paralelos que no existan en el código actual.

## 3. Arquitectura

La arquitectura actual está organizada en módulos CommonJS y sigue un flujo claro:

Cliente
→ Express
→ lógica del asistente
→ OpenAI Responses API
→ Function Calling cuando corresponde
→ almacenamiento PostgreSQL
→ respuesta HTTP

Principales archivos:

- `server.js`: bootstrap del servicio, carga de variables de entorno, validación de conexión a PostgreSQL, migración y arranque del servidor Express.
- `src/app.js`: define los endpoints HTTP y valida el cuerpo de las peticiones.
- `src/assistant.js`: orquesta la llamada a OpenAI, reutiliza `previous_response_id`, ejecuta herramientas y conserva el contexto de la conversación.
- `src/conversations.js`: implementa la lógica de adquisición/liberación de conversaciones, tanto en memoria como con PostgreSQL.
- `src/db.js`: centraliza la configuración de conexión, validación y migración de PostgreSQL.
- `src/openai.js`: crea el cliente de OpenAI usando `OPENAI_API_KEY` desde entorno.
- `src/tools.js`: define las herramientas permitidas, valida argumentos y ejecuta la función correspondiente.
- `src/time.js`: calcula contexto temporal y genera instrucciones de fechas para el asistente.
- `src/errors.js`: define errores controlados usados por la API.
- `migrations/`: contiene la migración de la base de datos.
- `scripts/`: incluye scripts de migración y prueba de reinicio.
- `tests/`: contiene la suite automatizada del proyecto.

El contexto de una conversación se recupera desde PostgreSQL y se combina con el historial que OpenAI recibe en cada turno. La persistencia evita que la conversación dependa únicamente del proceso en ejecución.

## 4. Variables de entorno

El proyecto requiere las siguientes variables de entorno:

- `OPENAI_API_KEY`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

### Reglas actuales

- `.env` contiene la configuración local y secretos del entorno.
- `.env` está ignorado por Git mediante `.gitignore`.
- `.env.example` sirve como plantilla base.
- `DB_PASSWORD` debe obtenerse exclusivamente desde `process.env.DB_PASSWORD`.
- No se utiliza `pgpass.conf`.
- No se usa `PGPASSWORD` como fallback.
- No se sobrescribe ni se reescribe la contraseña automáticamente.

Ejemplo seguro:

```env
OPENAI_API_KEY=<tu_api_key>
DB_HOST=127.0.0.1
DB_PORT=5433
DB_NAME=openai_chat_api
DB_USER=postgres
DB_PASSWORD=<tu_password_local>
```

## 5. Instalación

1. Instalar dependencias:

```bash
npm install
```

2. Configurar el archivo `.env` local con las variables necesarias.

3. Preparar PostgreSQL local con la base de datos y usuario indicados.

4. Ejecutar la migración:

```bash
npm run db:migrate
```

5. Iniciar el servidor:

```bash
npm start
```

También está disponible modo desarrollo con:

```bash
npm run dev
```

## 6. Base de datos

El proyecto usa PostgreSQL como backend de persistencia. La base de datos esperada es `openai_chat_api`, con host `127.0.0.1`, puerto `5433` y usuario `postgres`.

La migración crea la tabla `openai_chat_api_conversations` si no existe. La definición actual está en [migrations/001_conversations.sql](migrations/001_conversations.sql) y incluye lo siguiente:

- `conversation_id` (UUID primario)
- `mode` (`/chat` o `/function`)
- `previous_response_id`
- `response_id`
- `context` (JSONB)
- `status` (`active`, `processing`, `expired`)
- `created_at`
- `updated_at`

La tabla tiene un índice sobre `updated_at` y se usa como soporte de persistencia para las conversaciones. La migración es idempotente: puede ejecutarse repetidamente sin eliminar datos ni tablas existentes.

Cuando comienza una nueva conversación, el backend genera un UUID y crea una fila nueva en PostgreSQL. En turnos posteriores, la misma conversación se recupera por `conversation_id` y se actualiza su estado y su contexto.

## 7. Persistencia de conversaciones

La persistencia se implementa en `src/conversations.js` usando PostgreSQL como almacenamiento principal del estado de la conversación.

Se persisten los siguientes elementos:

- `conversation_id`: identificador único de la conversación.
- `response_id`: última respuesta válida del modelo asociada al turno.
- `previous_response_id`: identificador retenido para continuidad con OpenAI.
- `context`: JSON estructurado con datos de contexto y herramientas.
- `status`: estado de la conversación (`active`, `processing`, `expired`).

Esto permite que una conversación sobreviva a reinicios del proceso y pueda continuarse con el mismo `conversationId` en otro arranque del servidor.

La persistencia evita depender exclusivamente de memoria en proceso: si el servidor se reinicia, la fila sigue en PostgreSQL y el backend puede recuperar la conversación y continuar desde ahí.

## 8. Flujo multiturno

El flujo multiturno sigue una lógica real y comprobada por los tests.

### Turno 1

1. El cliente envía un mensaje al endpoint `/chat` o `/function`.
2. El backend crea o recupera la conversación.
3. Se genera y persiste el `conversation_id` cuando la conversación es nueva.
4. El asistente llama a OpenAI con el mensaje actual y el contexto necesario.
5. El servidor guarda la respuesta relevante y el estado actualizado.

### Turno 2

1. El cliente vuelve a enviar un mensaje con el mismo `conversationId`.
2. El backend recupera la fila de PostgreSQL.
3. Se reutiliza `previous_response_id` y el contexto guardado.
4. El modelo recibe el historial y la última respuesta asociada.
5. El backend actualiza la conversación persistida con el nuevo estado.

Si el mensaje no incluye todos los parámetros que necesita una herramienta, el sistema no ejecuta la tool inmediatamente. Guarda el contexto incompleto y solicita aclaración al usuario sobre los parámetros faltantes.

## 9. Function Calling

El Function Calling está implementado y se define en `src/tools.js` con las siguientes herramientas actuales:

- `getProfits`
- `getBestSellingProduct`
- `getWorstSellingProduct`
- `getTopCustomer`
- `getProductProfits`

Estas herramientas tienen validación de fechas y argumentos, y se ejecutan sobre funciones mock definidas en `src/mocks/functions.js`.

El flujo real es:

1. OpenAI decide que se requiere una tool.
2. El backend valida el JSON y los argumentos recibidos.
3. Si faltan parámetros, devuelve un estado de aclaración sin ejecutar la función.
4. Si todo es válido, ejecuta la función correspondiente.
5. El resultado se devuelve como `function_call_output` y se conserva el contexto en la conversación.

Los `tool outputs` también forman parte del contexto persistido para que las siguientes interacciones puedan continuar sin perder la información previa.

## 10. Manejo de fechas y contexto temporal

La lógica temporal está en `src/time.js` y se usa para orientar el asistente en periodos como hoy, ayer, este mes, mes pasado, esta semana y otros rangos relativos.

Comportamiento real implementado:

- Usa `America/La_Paz` por defecto como zona horaria.
- Calcula `today`, `yesterday`, `thisWeek`, `lastWeek`, `thisMonth`, `lastMonth`.
- Valida fechas con formato `YYYY-MM-DD`.
- Mantiene rangos inclusivos.
- Hace prioridad al año explícito del usuario cuando se menciona.
- Reutiliza el periodo recuperable del historial cuando la conversación ya tiene contexto.
- Si faltan datos del periodo y no pueden inferirse, solicita aclaración en vez de inventar un rango.

La lógica evita asumir fechas arbitrarias y usa el calendario del contexto como fuente de verdad.

## 11. API

La API actual expone dos endpoints HTTP:

### 1) POST /chat

Propósito: iniciar o continuar una conversación simple con OpenAI sin utilizar Function Calling.

Body esperado:

```json
{
  "message": "Hola servidor",
  "conversationId": "uuid-opcional"
}
```

Respuesta típica:

```json
{
  "response": "Respuesta del asistente",
  "conversationId": "uuid-generado-o-recuperado",
  "responseId": "resp_..."
}
```

Códigos relevantes:

- `200`: respuesta exitosa
- `400`: mensaje inválido o JSON incorrecto
- `404`: conversación inexistente o expirada
- `409`: conversación ocupada o se intenta continuar en un endpoint distinto
- `413`: body demasiado grande
- `500`: error interno del servidor
- `502`: error de OpenAI o de la tool

### 2) POST /function

Propósito: iniciar o continuar una conversación con Function Calling activo.

Body esperado:

```json
{
  "message": "¿Cuánto gané este mes?",
  "conversationId": "uuid-opcional"
}
```

Respuesta típica:

```json
{
  "response": "Respuesta final del asistente",
  "conversationId": "uuid-generado-o-recuperado",
  "responseId": "resp_..."
}
```

Este endpoint conserva el contexto de herramientas y su salida para que el flujo multiturno pueda continuar.

## 12. Ejecución

Los comandos reales disponibles en `package.json` son:

```bash
npm start
npm run dev
npm run db:migrate
npm test
npm run test:restart
```

Para poner el proyecto en marcha:

```bash
npm install
npm run db:migrate
npm start
```

## 13. Pruebas

La suite actual se ejecuta con el Node test runner y cubre varios aspectos del comportamiento real del proyecto.

### `npm test`

Valida:

- cálculo de fechas y contexto temporal
- validación de argumentos en tools
- manejo de fechas reales y de rangos
- mensajes incompletos y aclaraciones
- flujo HTTP y respuestas controladas
- errores seguros sin exponer secretos
- persistencia en memoria y comportamiento del almacén de conversaciones

### `node scripts/db-migrate.js`

Ejecuta la migración PostgreSQL y verifica la configuración de base de datos y credenciales.

### `npm run test:restart`

Verifica que una conversación persiste en PostgreSQL, se reinicia el proceso y luego puede continuarse con el mismo `conversationId` sin perder el contexto.

La verificación actual del proyecto concluyó con 15 pruebas pasando y 0 fallando.

## 14. Prueba de reinicio

La prueba de reinicio implementada en `scripts/test-restart.js` verifica el caso real siguiente:

1. Se crea una conversación.
2. Se ejecuta una primera solicitud y se guarda el estado en PostgreSQL.
3. Se cierra o reinicia el proceso.
4. Se inicia otro worker con la misma base de datos.
5. Se reutiliza el mismo `conversationId`.
6. El backend recupera `previous_response_id` y el contexto persistido desde PostgreSQL.
7. La conversación continúa sin perder continuidad ni crear una nueva sesión.

El test permite comprobar además que una conversación nueva queda separada y no reutiliza el mismo identificador.

## 15. Seguridad y buenas prácticas

Se implementan las medidas que sí existen en el proyecto:

- Se usan variables de entorno para secretos y configuración local.
- `.env` se mantiene ignorado por Git.
- No se almacenan API keys ni contraseñas dentro del código fuente.
- `DB_PASSWORD` se toma de `process.env.DB_PASSWORD`.
- No se usa `pgpass.conf` ni `PGPASSWORD` como fallback.
- La configuración de PostgreSQL se valida antes de crear el pool.
- Las consultas de PostgreSQL usan parámetros (`$1`, `$2`, etc.) en lugar de interpolar valores directamente en el SQL.
- Los errores HTTP no exponen detalles internos ni secretos.

## 16. Estructura del proyecto

```text
openai-chat-api/
├── .env
├── .env.example
├── .gitignore
├── migrations/
│   └── 001_conversations.sql
├── package.json
├── package-lock.json
├── scripts/
│   ├── db-migrate.js
│   └── test-restart.js
├── server.js
├── src/
│   ├── app.js
│   ├── assistant.js
│   ├── conversations.js
│   ├── db.js
│   ├── errors.js
│   ├── openai.js
│   ├── time.js
│   ├── tools.js
│   └── mocks/
│       ├── functions.js
│       └── ...
├── test.http
├── tests/
│   ├── app.test.js
│   ├── conversations-pg.test.js
│   ├── db.test.js
│   └── http-file.test.js
├── README.md
└── node_modules/
```

Se omite la carpeta `node_modules/` en una vista conceptual del repositorio; el resto corresponde al proyecto real.

## 17. Alcance del Entregable 5

El Entregable 5 incorpora lo siguiente:

- PostgreSQL real como backend de persistencia
- migraciones de base de datos
- almacenamiento de conversaciones
- recuperación de conversaciones
- continuidad de `conversation_id`
- continuidad de `previous_response_id`
- flujo multiturno persistente
- compatibilidad con la arquitectura existente
- pruebas automatizadas de persistencia y reinicio

Lo que no forma parte del Entregable 5 es la integración con datos empresariales reales ni la sustitución del mock actual por una fuente autorizada de negocio. Esa evolución queda para una etapa posterior y no está implementada en el proyecto actual.

## 18. Estado actual

| Componente | Estado |
|---|---|
| API | Implementado |
| OpenAI Responses API | Implementado |
| Function Calling | Implementado |
| PostgreSQL | Implementado |
| Persistencia | Implementado |
| Migraciones | Implementado |
| Multiturno | Implementado |
| Recuperación | Implementado |
| Reinicio | Validado |
| Tests | Validado |

## 19. Troubleshooting

Problemas comunes y cómo verificarlos:

- PostgreSQL apagado o no accesible: revisar `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` en `.env`.
- Puerto incorrecto: confirmar que el servidor se está levantando en el puerto esperado.
- Base de datos inexistente: crear la base indicada antes de ejecutar la migración.
- Variables `.env` faltantes: revisar el archivo local y la configuración del entorno.
- Contraseña incorrecta: revisar `DB_PASSWORD` en `.env` y que coincide con la configuración del usuario PostgreSQL local.
- Migración no ejecutada: correr `npm run db:migrate` antes de usar la aplicación.
- API key faltante: verificar `OPENAI_API_KEY` en el entorno local.

No se documentan contraseñas reales ni secretos en este README y no se recomienda almacenar información sensible en archivos de código.
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





