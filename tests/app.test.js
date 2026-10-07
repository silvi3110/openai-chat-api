const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createConversationStore } = require('../src/conversations');
const { temporalContext } = require('../src/time');
const { executeTool } = require('../src/tools');
const functions = require('../src/mocks/functions');

const dates = { startDate: '2024-02-01', endDate: '2024-02-29' };
const call = (name = 'getProfits', args = dates) => ({ type: 'function_call', name, call_id: 'call_1', arguments: JSON.stringify(args) });
const response = (id, output = [], output_text = 'Resultado mock') => ({ id, output, output_text, status: 'completed' });
async function withServer(client, run, options = {}) {
  const server = createApp({ client, ...options }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const post = async (body, endpoint = '/function', raw = false) => {
    const result = await fetch(`http://127.0.0.1:${server.address().port}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw ? body : JSON.stringify(body) });
    return { status: result.status, body: await result.json() };
  };
  try { await run(post); } finally { await new Promise(resolve => server.close(resolve)); }
}

test('calendar handles timezone, leap year, month/year boundaries and weeks', () => {
  const context = temporalContext(new Date('2025-01-01T02:00:00Z'), 'America/La_Paz');
  assert.equal(context.today, '2024-12-31');
  assert.deepEqual(context.lastMonth, ['2024-11-01', '2024-11-30']);
  assert.deepEqual(context.thisWeek, ['2024-12-30', '2024-12-31']);
  const january = temporalContext(new Date('2025-01-01T12:00:00Z'));
  assert.deepEqual(january.lastMonth, ['2024-12-01', '2024-12-31']);
  const march = temporalContext(new Date('2024-03-01T12:00:00Z'));
  assert.equal(march.yesterday, '2024-02-29');
  assert.deepEqual(march.thisMonth, ['2024-03-01', '2024-03-31']);
  assert.deepEqual(march.namedMonths.febrero, ['2024-02-01', '2024-02-29']);
  assert.deepEqual(march.lastWeek, ['2024-02-19', '2024-02-25']);
});

test('backend validates unknown tools, JSON, real dates, range and product', async () => {
  for (const invalid of [call('toString'), { ...call(), arguments: '{' }, call('getProfits', {startDate:'2023-02-29',endDate:'2023-03-01'}), call('getProfits', {startDate:'2024-03-01',endDate:'2024-02-01'}), call('getProfits', {...dates, product:'extra'})]) await assert.rejects(executeTool(invalid), error => error.status === 502);
  assert.deepEqual((await executeTool(call('getProfits', {}))).missing, ['startDate', 'endDate']);
  assert.deepEqual((await executeTool(call('getProductProfits', {...dates, product:' '}))).missing, ['product']);
  assert.equal((await executeTool(call())).result.profits, 1000);
  assert.equal((await executeTool(call('getWorstSellingProduct'))).result.product, 'Yogurt Natural');
  assert.equal((await executeTool(call('getProductProfits', {...dates, product:'Leche PIL'}))).result.profits, 600);
  assert.equal((await executeTool(call('getProductProfits', {...dates, product:'unknown'}))).result.found, false);
  const original = functions.getProfits;
  try {
    functions.getProfits = () => { throw new Error('private failure'); };
    await assert.rejects(executeTool(call()), error => error.status === 500 && !error.message.includes('private'));
  } finally { functions.getProfits = original; }
});

test('mock sales data includes enough variation for multi-product, multi-customer and multi-period demonstrations', () => {
  const { sales, customers, productProfits, bestProduct, worstProduct, topCustomer } = require('../src/mocks/data');
  assert.ok(Array.isArray(sales) && sales.length >= 10, 'expected a richer sales record set');
  assert.ok(new Set(sales.map(item => item.product)).size >= 4, 'expected multiple products');
  assert.ok(new Set(sales.map(item => item.customer)).size >= 3, 'expected multiple customers');
  assert.ok(sales.some(item => item.date.startsWith('2024-')) && sales.some(item => item.date.startsWith('2026-')),
    'expected date coverage across multiple periods');
  assert.ok(productProfits.some(item => item.product === 'Leche PIL'));
  assert.ok(productProfits.some(item => item.product === 'Yogurt Natural'));
  assert.ok(bestProduct.product && worstProduct.product && topCustomer.customer);
});

test('incomplete tool arguments are returned for clarification without running a mock', async () => {
  let calls = 0;
  const original = functions.getProductProfits;
  functions.getProductProfits = (...args) => { calls++; return original(...args); };
  try {
    const execution = await executeTool(call('getProductProfits', { startDate: null, endDate: null, product: 'Yogurt Natural' }));
    assert.deepEqual(execution.missing, ['startDate', 'endDate']);
    assert.equal(calls, 0);
  } finally { functions.getProductProfits = original; }
});

test('clarification persists partial arguments and the follow-up executes with the supplied period', async () => {
  const requests = [];
  const replies = [
    response('r1', [call('getProductProfits', { startDate: null, endDate: null, product: 'Yogurt Natural' })]),
    response('r2', [], '¿Para qué periodo quieres consultar las ganancias de Yogurt Natural?'),
    response('r3', [call('getProductProfits', { ...dates, product: 'Yogurt Natural' })]),
    response('r4'),
  ];
  const client = { responses: { create: async request => { requests.push(request); return replies.shift(); } } };
  let calls = 0;
  const original = functions.getProductProfits;
  functions.getProductProfits = (...args) => { calls++; return original(...args); };
  try {
    await withServer(client, async post => {
      const first = await post({ message: '¿Cuánto gané con Yogurt Natural?' });
      assert.equal(first.status, 200);
      assert.match(first.body.response, /periodo/i);
      assert.equal(calls, 0);
      const missing = JSON.parse(requests[1].input[0].output);
      assert.deepEqual(missing.missing_parameters, ['startDate', 'endDate']);
      const second = await post({ message: 'En agosto.', conversationId: first.body.conversationId });
      assert.equal(second.status, 200);
      assert.equal(requests[2].previous_response_id, 'r2');
      assert.match(requests[2].instructions, /pendingTool/);
      assert.equal(calls, 1);
    });
  } finally { functions.getProductProfits = original; }
});

test('conversation store rejects invalid, missing, busy, mismatched and expired IDs', () => {
  let now = 0;
  const store = createConversationStore({ now: () => now, ttl: 100, max: 1 });
  assert.throws(() => store.acquire('bad', '/function'), {status:400});
  const entry = store.acquire(undefined, '/function');
  assert.throws(() => store.acquire(entry.id, '/function'), {status:409});
  assert.throws(() => store.acquire(undefined, '/function'), {status:503});
  store.release(entry, 'resp_1');
  assert.throws(() => store.acquire(entry.id, '/chat'), {status:409});
  now = 101;
  assert.throws(() => store.acquire(entry.id, '/function'), {status:404});
});

test('HTTP preserves tool outputs, final response continuity and independent conversations', async () => {
  const requests = [];
  const replies = [response('r1', [call()]), response('r2'), response('r3', [call('getWorstSellingProduct')]), response('r4'), response('r5')];
  const client = { responses: { create: async request => { requests.push(request); return replies.shift(); } } };
  await withServer(client, async post => {
    const first = await post({ message:'profits' });
    assert.equal(first.status, 200);
    assert.equal(requests[1].previous_response_id, 'r1');
    assert.equal(requests[1].input[0].call_id, 'call_1');
    assert.equal(JSON.parse(requests[1].input[0].output).profits, 1000);
    const second = await post({ message:'follow up', conversationId:first.body.conversationId });
    assert.equal(second.status, 200);
    assert.equal(requests[2].previous_response_id, 'r2');
    assert.equal(second.body.responseId, 'r4');
    assert.notEqual(requests[2].instructions, requests[0].instructions);
    assert.match(requests[2].instructions, /"lastTool"/);
    const independent = await post({message:'hello'}, '/chat');
    assert.equal(independent.status, 200);
    assert.notEqual(independent.body.conversationId, first.body.conversationId);
    assert.equal(requests[4].previous_response_id, undefined);
    assert.equal(requests[4].tools, undefined);
  }, { clock: () => new Date('2025-01-01T12:00:00Z') });
});

test('HTTP errors are safe and invalid bodies never call OpenAI', async () => {
  let calls = 0;
  const client = { responses: { create: async () => { calls++; throw Object.assign(new Error('secret'), {status:401}); } } };
  await withServer(client, async post => {
    for (const endpoint of ['/chat', '/function']) {
      for (const body of [{}, {message:''}, {message:'   '}, {message:123}, {message:'x',conversationId:null}]) assert.equal((await post(body, endpoint)).status, 400);
    }
    assert.equal((await post('{', '/function', true)).status, 400);
    assert.equal(calls, 0);
    const result = await post({message:'hello'});
    assert.equal(result.status, 502);
    assert.ok(!JSON.stringify(result).includes('secret'));
  });
});

test('failed follow-up leaves the last successful response usable', async () => {
  const requests = [];
  const client = {responses:{create:async req => {
    requests.push(req);
    if (requests.length === 2) throw new Error('network');
    return response(`r${requests.length}`);
  }}};
  await withServer(client, async post => {
    const first = await post({message:'hello'});
    const body = {message:'again',conversationId:first.body.conversationId};
    assert.equal((await post(body)).status, 502);
    assert.equal((await post(body)).status, 200);
    assert.equal(requests[2].previous_response_id, 'r1');
  });
});

test('tool loop is bounded and incomplete responses fail safely', async () => {
  let count = 0;
  await withServer({responses:{create:async () => {count++; return response(`r${count}`, [call()]);}}}, async post => {
    assert.equal((await post({message:'loop'})).status, 502);
    assert.equal(count, 6);
  });
  await withServer({responses:{create:async () => ({...response('r'),status:'incomplete'})}}, async post => {
    assert.equal((await post({message:'hello'})).status, 502);
  });
});


test('HTTP returns 404 for missing and expired conversations and remains available', async () => {
  let now = 0;
  let providerCalls = 0;
  const store = createConversationStore({ now: () => now, ttl: 10 });
  const client = { responses: { create: async () => { providerCalls++; return response('r1'); } } };
  await withServer(client, async post => {
    assert.equal((await post({ message: 'hello', conversationId: '11111111-1111-4111-8111-111111111111' })).status, 404);
    assert.equal(providerCalls, 0);
    const first = await post({ message: 'hello' });
    assert.equal(first.status, 200);
    now = 11;
    assert.equal((await post({ message: 'again', conversationId: first.body.conversationId })).status, 404);
    assert.equal(providerCalls, 1);
    assert.equal((await post({ message: 'new conversation' })).status, 200);
  }, { store });
});