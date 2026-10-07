// POC mock dataset: mantiene los valores de referencia del Entregable 4 pero amplía la variedad
// de productos, clientes, fechas y rangos para demostrar las herramientas del Entregable 5.
module.exports = {
  profits: 1000,
  bestProduct: { product: 'Leche PIL', quantity: 150 },
  worstProduct: { product: 'Yogurt Natural', quantity: 20 },
  topCustomer: { customer: 'Juan Pérez', purchases: 25 },
  sales: [
    { date: '2024-01-12', product: 'Leche PIL', customer: 'Juan Pérez', quantity: 30, unitPrice: 12, revenue: 360 },
    { date: '2024-02-01', product: 'Leche PIL', customer: 'Juan Pérez', quantity: 40, unitPrice: 15, revenue: 600 },
    { date: '2024-02-08', product: 'Yogurt Natural', customer: 'María López', quantity: 20, unitPrice: 12, revenue: 240 },
    { date: '2024-02-15', product: 'Queso Andino', customer: 'Carlos Mendoza', quantity: 18, unitPrice: 13, revenue: 234 },
    { date: '2024-02-20', product: 'Pan Integral', customer: 'Ana García', quantity: 24, unitPrice: 9, revenue: 216 },
    { date: '2024-03-04', product: 'Jugo Naranja', customer: 'Luis Ramírez', quantity: 60, unitPrice: 10, revenue: 600 },
    { date: '2024-08-10', product: 'Queso Andino', customer: 'Juan Pérez', quantity: 35, unitPrice: 14, revenue: 490 },
    { date: '2024-08-18', product: 'Leche PIL', customer: 'María López', quantity: 28, unitPrice: 15, revenue: 420 },
    { date: '2024-09-06', product: 'Yogurt Natural', customer: 'Carlos Mendoza', quantity: 22, unitPrice: 12, revenue: 264 },
    { date: '2025-01-15', product: 'Pan Integral', customer: 'Ana García', quantity: 60, unitPrice: 8, revenue: 480 },
    { date: '2026-09-03', product: 'Leche PIL', customer: 'Juan Pérez', quantity: 50, unitPrice: 16, revenue: 800 },
    { date: '2026-09-08', product: 'Yogurt Natural', customer: 'María López', quantity: 25, unitPrice: 12, revenue: 300 },
    { date: '2026-09-14', product: 'Queso Andino', customer: 'Carlos Mendoza', quantity: 26, unitPrice: 15, revenue: 390 },
  ],
  customers: [
    { customer: 'Juan Pérez', purchases: 25 },
    { customer: 'María López', purchases: 18 },
    { customer: 'Carlos Mendoza', purchases: 15 },
    { customer: 'Ana García', purchases: 12 },
    { customer: 'Luis Ramírez', purchases: 8 },
  ],
  productProfits: [
    { product: 'Yogurt Natural', profits: 240 },
    { product: 'Leche PIL', profits: 600 },
    { product: 'Queso Andino', profits: 420 },
    { product: 'Pan Integral', profits: 350 },
    { product: 'Jugo Naranja', profits: 300 },
  ],
};
