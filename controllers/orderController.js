import * as orderService from "../services/orderService.js";

// Express 5 forwards rejected promises to the error handler, so no try/catch needed here

// POST /api/orders  (JSON: customer, shippingAddress, items: [{ productId, size, quantity }], paymentMethod, notes)
export async function createOrder(req, res) {
  const order = await orderService.createOrder(req.body);
  res.status(201).json({ success: true, order });
}

// GET /api/orders?status=pending&paymentStatus=&paymentMethod=&search=&from=&to=&sort=newest&page=1&limit=20
export async function getOrders(req, res) {
  const result = await orderService.getOrders(req.query);
  res.json({ success: true, ...result });
}

// GET /api/orders/options
export function getOrderOptions(req, res) {
  res.json({ success: true, ...orderService.getOrderOptions() });
}

// GET /api/orders/track?orderNumber=ZLR-100001&email=customer@example.com
export async function trackOrder(req, res) {
  const order = await orderService.trackOrder(req.query.orderNumber, req.query.email);
  res.json({ success: true, order });
}

// GET /api/orders/:idOrNumber
export async function getOrder(req, res) {
  const order = await orderService.getOrder(req.params.idOrNumber);
  res.json({ success: true, order });
}

// PATCH /api/orders/:id/status  (JSON: status, paymentStatus, note)
export async function updateOrderStatus(req, res) {
  const order = await orderService.updateOrderStatus(req.params.id, req.body);
  res.json({ success: true, order });
}
