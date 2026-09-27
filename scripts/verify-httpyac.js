// Runs the core bundled in the installed httpYac 6.16.7 extension, without changing it.
// Usage: node scripts/verify-httpyac.js <extension-directory>
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { createClient } = require('../src/openai');
const { createApp } = require('../src/app');
const { temporalContext } = require('../src/time');

function loadInstalledEngine(directory) {
  if (!directory) throw new Error('Pass the installed anweber.vscode-httpyac-6.16.7 directory');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  assert.equal(manifest.version, '6.16.7', 'This inspection harness supports the inspected bundle version');
  const filename = path.join(directory, 'dist', 'extension.js');
  const source = fs.readFileSync(filename, 'utf8');
  const boundary = source.indexOf('var icr={}');
  assert.ok(boundary > 0 && source.includes('var pr=Se(Sr()),Nn=require("vscode")'));
  // Load the unchanged core before the VS Code UI adapter. No parser or resolver replacement.
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = module.paths;
  loaded._compile(source.slice(0, boundary) + ';module.exports=Sr();', filename);
  return loaded.exports;
}

async function main() {
  const api = loadInstalledEngine(process.argv[2]);
  api.cli.initFileProvider();
  const store = new api.store.HttpFileStore();
  const filename = path.resolve('test.http');
  const file = await store.getOrCreate(filename, async () => fs.readFileSync(filename, 'utf8'), 1,
    { workingDir: process.cwd(), config: {} });
  const events = [];
  const exchanges = [];
  const actual = createClient();
  const client = { responses: { create: async input => {
    const output = await actual.responses.create(input);
    exchanges.push({ previous_response_id: input.previous_response_id, input: input.input,
      response_id: output.id, calls: output.output.filter(item => item.type === 'function_call') });
    return output;
  } } };
  const server = createApp({ client, log: (event, data) => events.push({ event, ...data }) }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  // Only the destination port changes in memory; request bodies/references come from test.http.
  for (const region of file.httpRegions) {
    if (region.request) region.request.url = region.request.url.replace('http://localhost:3000', url);
  }
  const results = [];
  const context = temporalContext();
  const pairs = [
    ['multi1', 'getBestSellingProduct', 'getWorstSellingProduct', context.thisMonth, context.thisMonth],
    ['multi2', 'getTopCustomer', 'getTopCustomer', context.namedMonths.septiembre, context.namedMonths.agosto],
    ['multi3', 'getProfits', 'getProfits', context.thisMonth, context.lastMonth],
    ['multi4', 'getProductProfits', 'getProductProfits', context.thisMonth, context.lastMonth],
    ['multi5', 'getBestSellingProduct', 'getWorstSellingProduct', context.thisMonth, context.thisMonth],
    ['multi6', 'getProfits', 'getProfits', context.thisMonth, context.lastMonth],
    ['multi7', 'getProductProfits', 'getProductProfits', context.thisMonth, context.lastMonth],
  ];
  try {
    for (const [name, firstTool, secondTool, firstRange, secondRange] of pairs) {
      const offset = events.length;
      const start = exchanges.length;
      const followUp = file.httpRegions.find(region => region.metaData.name === `${name}FollowUp`);
      assert.ok(followUp);
      // Send turn 2 with a cold cache: the actual @ref hook must execute turn 1 automatically.
      const success = await api.send({ httpFile: file, httpRegion: followUp, config: {} });
      assert.equal(success, true, `${name}: httpYac execution failed`);
      const trace = events.slice(offset);
      const queries = trace.filter(event => event.event === 'consulta');
      const calls = trace.filter(event => event.event === 'tool_ejecutada');
      const wire = exchanges.slice(start);
      assert.equal(queries.length, 2, 'The reference must trigger exactly one first turn');
      assert.equal(queries[0].conversationId, queries[1].conversationId);
      assert.equal(queries[1].previous_response_id, wire[1].response_id);
      assert.equal(calls.length, 2);
      for (const [index, tool, range] of [[0, firstTool, firstRange], [1, secondTool, secondRange]]) {
        assert.equal(calls[index].tool, tool);
        assert.deepEqual(calls[index].arguments, { startDate: range[0], endDate: range[1],
          ...(tool === 'getProductProfits' ? { product: 'Yogurt Natural' } : {}) });
        const call = wire[index * 2].calls[0];
        assert.equal(call.name, tool);
        assert.equal(wire[index * 2 + 1].input[0].type, 'function_call_output');
        assert.equal(wire[index * 2 + 1].input[0].call_id, call.call_id);
      }
      results.push({ name, passed: true, trace, exchanges: wire });
      console.log(`PASS ${name}: @ref + UUID + tools + dates + call_id`);
    }
  } finally {
    fs.writeFileSync('verification-httpyac.json', JSON.stringify({ date: new Date().toISOString(),
      engine: 'installed vscode-httpyac 6.16.7 core', context, results,
      completed: results.length === pairs.length }, null, 2));
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error('httpYac verification failed:', error.message); process.exitCode = 1; });
