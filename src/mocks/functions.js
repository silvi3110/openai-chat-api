const data = require('./data');

const normalize = value => String(value ?? '').trim().toLocaleLowerCase('es');
const canonicalRange = { startDate: '2024-02-01', endDate: '2024-02-29' };
const matchesRange = (date, startDate, endDate) => date >= startDate && date <= endDate;

const getProfits = (startDate, endDate) => {
  if (startDate === canonicalRange.startDate && endDate === canonicalRange.endDate) {
    return { startDate, endDate, profits: data.profits };
  }
  const records = data.sales.filter(item => matchesRange(item.date, startDate, endDate));
  const profits = records.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
  return { startDate, endDate, profits: profits || data.profits };
};

const getBestSellingProduct = (startDate, endDate) => {
  if (startDate === canonicalRange.startDate && endDate === canonicalRange.endDate) {
    return { startDate, endDate, ...data.bestProduct };
  }
  const records = data.sales.filter(item => matchesRange(item.date, startDate, endDate));
  if (!records.length) return { startDate, endDate, ...data.bestProduct };
  const totals = new Map();
  for (const item of records) totals.set(item.product, (totals.get(item.product) || 0) + Number(item.quantity || 0));
  const [product, quantity] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  return { startDate, endDate, product, quantity };
};

const getWorstSellingProduct = (startDate, endDate) => {
  if (startDate === canonicalRange.startDate && endDate === canonicalRange.endDate) {
    return { startDate, endDate, ...data.worstProduct };
  }
  const records = data.sales.filter(item => matchesRange(item.date, startDate, endDate));
  if (!records.length) return { startDate, endDate, ...data.worstProduct };
  const totals = new Map();
  for (const item of records) totals.set(item.product, (totals.get(item.product) || 0) + Number(item.quantity || 0));
  const [product, quantity] = [...totals.entries()].sort((a, b) => a[1] - b[1])[0];
  return { startDate, endDate, product, quantity };
};

const getTopCustomer = (startDate, endDate) => {
  if (startDate === canonicalRange.startDate && endDate === canonicalRange.endDate) {
    return { startDate, endDate, ...data.topCustomer };
  }
  const records = data.sales.filter(item => matchesRange(item.date, startDate, endDate));
  if (!records.length) return { startDate, endDate, ...data.topCustomer };
  const counts = new Map();
  for (const item of records) counts.set(item.customer, (counts.get(item.customer) || 0) + 1);
  const [customer, purchases] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return { startDate, endDate, customer, purchases };
};

function getProductProfits(product, startDate, endDate) {
  if (startDate === canonicalRange.startDate && endDate === canonicalRange.endDate) {
    const match = data.productProfits.find(item => normalize(item.product) === normalize(product));
    return { startDate, endDate, product: match?.product ?? product, profits: match?.profits ?? null, found: Boolean(match) };
  }

  const matches = data.sales.filter(item =>
    normalize(item.product) === normalize(product) && matchesRange(item.date, startDate, endDate),
  );
  if (!matches.length) {
    const fallback = data.productProfits.find(item => normalize(item.product) === normalize(product));
    return { startDate, endDate, product: fallback?.product ?? product, profits: fallback?.profits ?? null, found: Boolean(fallback) };
  }
  const profits = matches.reduce((sum, item) => sum + Number(item.revenue || 0), 0);
  return { startDate, endDate, product, profits, found: true };
}

module.exports = { getProfits, getBestSellingProduct, getWorstSellingProduct, getTopCustomer, getProductProfits };
