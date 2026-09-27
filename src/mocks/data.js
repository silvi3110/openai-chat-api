// Fixtures del POC: no representan ventas reales ni varían según las fechas.
module.exports = {
  profits: 1000,
  bestProduct: { product: 'Leche PIL', quantity: 150 },
  worstProduct: { product: 'Yogurt Natural', quantity: 20 },
  topCustomer: { customer: 'Juan Pérez', purchases: 25 },
  productProfits: [
    { product: 'Yogurt Natural', profits: 240 },
    { product: 'Leche PIL', profits: 600 },
  ],
};
