const functions = require('./mocks/functions');
const { AppError } = require('./errors');
const descriptions = {
  getProfits: 'Obtiene las ganancias totales del negocio durante un periodo.',
  getBestSellingProduct: 'Obtiene el producto más vendido y su cantidad durante un periodo.',
  getWorstSellingProduct: 'Obtiene el producto menos vendido y su cantidad. El backend descubre el producto, no lo inventes.',
  getTopCustomer: 'Obtiene el cliente con más compras durante un periodo: quién compró más, mejor cliente.',
  getProductProfits: 'Obtiene la ganancia de un producto específico durante un periodo. Extrae el producto de la consulta o del historial.',
};
const tools = Object.entries(descriptions).map(([name, description]) => {
  const properties = {
    startDate: { type: ['string', 'null'], description: 'Inicio inclusivo YYYY-MM-DD; null si el usuario no indicó un periodo recuperable.' },
    endDate: { type: ['string', 'null'], description: 'Fin inclusivo YYYY-MM-DD; null si el usuario no indicó un periodo recuperable.' },
  };
  if (name === 'getProductProfits') properties.product = { type: ['string', 'null'], description: 'Nombre del producto solicitado; null si no se indicó ni puede recuperarse.' };
  return { type: 'function', name, description, strict: true,
    parameters: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false } };
});

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
async function executeTool(call) {
  const tool = tools.find(item => item.name === call.name);
  if (!tool) throw new AppError(502, 'OpenAI solicitó una tool desconocida');
  let args;
  try { args = JSON.parse(call.arguments); } catch { throw new AppError(502, 'La tool recibió JSON inválido'); }
  const keys = tool.parameters.required;
  if (!args || Array.isArray(args) || typeof args !== 'object' || Object.keys(args).some(key => !keys.includes(key))) {
    throw new AppError(502, 'La tool recibió argumentos faltantes o inválidos');
  }
  const missing = keys.filter(key => args[key] === undefined || args[key] === null ||
    (key === 'product' && typeof args[key] === 'string' && !args[key].trim()));
  if (missing.length) return { args, missing };
  if (!validDate(args.startDate) || !validDate(args.endDate) || args.startDate > args.endDate ||
      (keys.includes('product') && (typeof args.product !== 'string' || args.product.length > 200))) {
    throw new AppError(502, 'La tool recibió argumentos faltantes o inválidos');
  }
  try {
    const result = call.name === 'getProductProfits'
      ? await functions[call.name](args.product, args.startDate, args.endDate)
      : await functions[call.name](args.startDate, args.endDate);
    return { args, result, missing: [] };
  } catch { throw new AppError(500, 'Error durante la ejecución de la función'); }
}
module.exports = { tools, executeTool, validDate };


