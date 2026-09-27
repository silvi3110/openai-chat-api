const data = require('./data');

// Sustituir estas implementaciones por consultas autorizadas a Tiendishop.
const getProfits = (startDate, endDate) => ({ startDate, endDate, profits: data.profits });
const getBestSellingProduct = (startDate, endDate) => ({ startDate, endDate, ...data.bestProduct });
const getWorstSellingProduct = (startDate, endDate) => ({ startDate, endDate, ...data.worstProduct });
const getTopCustomer = (startDate, endDate) => ({ startDate, endDate, ...data.topCustomer });
function getProductProfits(product, startDate, endDate) {
  const match = data.productProfits.find(item => item.product.toLocaleLowerCase('es') === product.trim().toLocaleLowerCase('es'));
  return { startDate, endDate, product: match?.product ?? product, profits: match?.profits ?? null, found: Boolean(match) };
}
module.exports = { getProfits, getBestSellingProduct, getWorstSellingProduct, getTopCustomer, getProductProfits };
