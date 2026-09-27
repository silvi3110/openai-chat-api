// Prueba real: usa el SDK instalado, la API y HTTP local. Consume tokens.
require('dotenv').config({quiet:true});
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createApp } = require('../src/app');
const { createClient } = require('../src/openai');
const { temporalContext } = require('../src/time');

async function main() {
  const events = [];
  const evidence = [];
  const context = temporalContext();
  const protocol = [];
  const provider = createClient();
  const client = { responses: { create: async request => {
    const result = await provider.responses.create(request);
    protocol.push({ previous_response_id: request.previous_response_id, input: request.input,
      response_id: result.id, calls: result.output.filter(item => item.type === 'function_call') });
    return result;
  } } };
  const server = createApp({client, log:(event, data) => {
    events.push({event,...data});
    console.log(JSON.stringify({event,...data}));
  }}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  let failures = 0;
  async function check(label, message, expected, conversationId, endpoint = '/function') {
    const offset = events.length; const protocolOffset = protocol.length;
    const res = await fetch(url + endpoint, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message,...(conversationId ? {conversationId} : {})})});
    const body = await res.json();
    const current = events.slice(offset);
    const calls = current.filter(event => event.event === 'tool_ejecutada');
    const wire = protocol.slice(protocolOffset); const record = {label, status:res.status, body, events:current, protocol:wire};
    evidence.push(record);
    try {
      assert.equal(res.status, 200, JSON.stringify(body));
      assert.ok(body.response?.trim());
      if (expected) {
        assert.equal(calls.length, 1);
        assert.equal(calls[0].tool, expected.tool);
        assert.deepEqual(calls[0].arguments, expected.args);
        const requested = wire[0].calls[0];
        assert.equal(requested.name, expected.tool);
        assert.equal(wire[1].input[0].type, 'function_call_output');
        assert.equal(wire[1].input[0].call_id, requested.call_id);
        assert.equal(wire[1].previous_response_id, wire[0].response_id);
      } else assert.equal(calls.length, 0);
      if (conversationId) {
        assert.equal(body.conversationId, conversationId);
        const earlier = evidence.slice(0, -1).findLast(item => item.body?.conversationId === conversationId);
        assert.equal(wire[0].previous_response_id, earlier.body.responseId);
      }
      record.passed = true;
      console.log(`PASS ${label}`);
    } catch (error) {
      failures++;
      record.passed = false;
      record.failure = error.message;
      console.log(`FAIL ${label}: ${error.message}`);
    }
    if (res.status !== 200) throw new Error(`Dependencia externa o backend no disponible: HTTP ${res.status}`);
    return body;
  }
  const expected = (tool, range, product) => ({tool,args:{startDate:range[0],endDate:range[1],...(product ? {product} : {})}});
  const month = context.thisMonth;
  const last = context.lastMonth;
  const september = [`${context.year}-09-01`,`${context.year}-09-30`];
  const august = [`${context.year}-08-01`,`${context.year}-08-31`];
  try {
    await check('chat anterior', 'Responde hola en español', null, undefined, '/chat');
    await check('A septiembre año actual', '¿Quién compró más en septiembre?', expected('getTopCustomer',september));
    await check('B año explícito', '¿Quién compró más en agosto de 2024?', expected('getTopCustomer',['2024-08-01','2024-08-31']));
    await check('C casual producto', '¿Cuál vendí más este mes?', expected('getBestSellingProduct',month));
    await check('D ayer', '¿Cuánto gané ayer?', expected('getProfits',[context.yesterday,context.yesterday]));
    await check('E producto', '¿Cuánto gané con Yogurt Natural este mes?', expected('getProductProfits',month,'Yogurt Natural'));
    const one = await check('M1 turno 1', '¿Cuál vendí más este mes?', expected('getBestSellingProduct',month));
    const two = await check('M2 turno 1', '¿Quién compró más en septiembre?', expected('getTopCustomer',september));
    await check('M1 turno 2 intercalado', '¿Y el que menos?', expected('getWorstSellingProduct',month),one.conversationId);
    await check('M2 turno 2 intercalado', '¿Y en agosto?', expected('getTopCustomer',august),two.conversationId);
    const three = await check('M3 turno 1', '¿Cuánto gané este mes?', expected('getProfits',month));
    await check('M3 turno 2', '¿Y el mes pasado?', expected('getProfits',last),three.conversationId);
    const four = await check('M4 turno 1', '¿Cuánto gané con Yogurt Natural este mes?', expected('getProductProfits',month,'Yogurt Natural'));
    await check('M4 turno 2', '¿Y el mes pasado?', expected('getProductProfits',last,'Yogurt Natural'),four.conversationId);
    await check('mes pasado independiente', '¿Cuánto gané el mes pasado?', expected('getProfits',last));
    await check('casual cliente sin periodo', '¿Quién compró más?', null);
    await check('hoy', '¿Cuánto gané hoy?', expected('getProfits',[context.today,context.today]));
    await check('esta semana', '¿Cuánto gané esta semana?', expected('getProfits',context.thisWeek));
    await check('semana pasada', '¿Cuánto gané la semana pasada?', expected('getProfits',context.lastWeek));
    await check('día sin año', '¿Quién compró más el 10 de septiembre?', expected('getTopCustomer',[`${context.year}-09-10`,`${context.year}-09-10`]));
    await check('producto variable', '¿Cuánto gané con Leche PIL este mes?', expected('getProductProfits',month,'Leche PIL'));
    await check('producto desconocido', '¿Cuánto gané con Queso Andino este mes?', expected('getProductProfits',month,'Queso Andino'));
    await check('aclaración cliente', '¿Quién fue mi mejor cliente?', null);
    await check('aclaración producto', '¿Qué producto vendí más?', null);
    const clarification = await check('aclaración ganancia producto', '¿Cuánto gané con Yogurt Natural?', null);
    await check('completar aclaración', 'Este mes', expected('getProductProfits',month,'Yogurt Natural'),clarification.conversationId);
    const previous = await check('anterior turno 1', '¿Cuánto gané este mes?', expected('getProfits',month));
    await check('anterior turno 2', '¿Y el anterior?', expected('getProfits',last),previous.conversationId);
    await check('regresión rango original', '¿Cuánto gané del 1 de septiembre de 2026 al 5 de septiembre de 2026?', expected('getProfits',['2026-09-01','2026-09-05']));
  } catch (error) {
    failures++;
    evidence.push({blocked:error.message});
    console.log(error.message);
  } finally {
    fs.writeFileSync('verification-live.json', JSON.stringify({date:new Date().toISOString(),context,failures,evidence},null,2));
    await new Promise(resolve => server.close(resolve));
  }
  console.log(`Verificación real: ${evidence.filter(item => item.passed).length} aprobadas, ${failures} fallos/bloqueos.`);
  if (failures) process.exitCode = 1;
}
main().catch(() => { console.error('No se pudo iniciar la verificación; revisa configuración local.'); process.exitCode = 1; });


