const { tools, executeTool } = require('./tools');
const { temporalContext, instructions } = require('./time');
const { AppError } = require('./errors');

function createAssistant({ client, log = () => {}, clock = () => new Date() }) {
  return async function respond(message, conversation, withTools) {
    const context = temporalContext(clock());
    const base = { model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', store: true,
      instructions: instructions(context, withTools, conversation.context), ...(withTools ? { tools } : {}) };
    let previous = conversation.responseId;
    let input = [{ role: 'user', content: message }];
    log('consulta', { conversationId: conversation.id, message, previous_response_id: previous, temporalContext: context });
    for (let round = 0; round < 6; round++) {
      let response;
      try {
        response = await client.responses.create({ ...base, input, ...(previous ? { previous_response_id: previous } : {}) });
      } catch (error) {
        log('openai_error', { conversationId: conversation.id, status: Number(error.status) || null });
        throw new AppError(error.status === 429 ? 503 : 502, 'Error al comunicarse con OpenAI; intenta nuevamente');
      }
      log('respuesta_openai', { conversationId: conversation.id, response_id: response.id, previous_response_id: previous });
      if (response.status !== 'completed') throw new AppError(502, 'OpenAI no completó la respuesta');
      const calls = response.output.filter(item => item.type === 'function_call');
      if (!calls.length) {
        if (!response.output_text?.trim()) throw new AppError(502, 'OpenAI no devolvió una respuesta de texto');
        return { response: response.output_text, conversationId: conversation.id, responseId: response.id };
      }
      if (!withTools) throw new AppError(502, 'Tool no disponible en este endpoint');
      input = [];
      for (const call of calls) {
        const execution = await executeTool(call);
        if (execution.missing.length) {
          const provided = Object.fromEntries(Object.entries(execution.args).filter(([key, value]) => value !== null && value !== undefined));
          conversation.context = { ...conversation.context, pendingTool: { name: call.name, arguments: provided, missing: execution.missing } };
          const output = { clarification_required: true, missing_parameters: execution.missing, provided_arguments: provided };
          log('tool_datos_faltantes', { conversationId: conversation.id, tool: call.name, missing: execution.missing });
          input.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(output) });
          continue;
        }
        const { args, result } = execution;
        conversation.context = { ...conversation.context, lastTool: { name: call.name, arguments: args } };
        delete conversation.context.pendingTool;
        log('tool_ejecutada', { conversationId: conversation.id, tool: call.name, arguments: args, result });
        input.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
      }
      previous = response.id;
    }
    throw new AppError(502, 'Se alcanzó el límite de llamadas de funciones');
  };
}
module.exports = { createAssistant };
