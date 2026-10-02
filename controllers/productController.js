import * as productService from "../services/productService.js";

// Express 5 forwards rejected promises to the error handler, so no try/catch needed here

// GET /api/products?category=rings&collection=fine-jewellery&newArrival=true&minPrice=&maxPrice=&size=&search=&sort=price-asc&page=1&limit=12
export async function getProducts(req, res) {
  const result = await productService.getProducts(req.query);
  res.json({ success: true, ...result });
}

// GET /api/products/search?q=gold ring&category=&collection=&minPrice=&maxPrice=&size=&newArrival=&sort=relevance&page=1&limit=12
export async function searchProducts(req, res) {
  const result = await productService.searchProducts(req.query);
  res.json({ success: true, ...result });
}

// GET /api/products/search/suggestions?q=sol&limit=6
export async function getSearchSuggestions(req, res) {
  const result = await productService.getSearchSuggestions(req.query.q, req.query.limit);
  res.json({ success: true, ...result });
}

// GET /api/products/menu
export function getMenu(req, res) {
  res.json({ success: true, menu: productService.getMenu() });
}

// GET /api/products/menu/:menuSlug
export async function getProductsByMenu(req, res) {
  const result = await productService.getProductsByMenu(req.params.menuSlug, req.query);
  res.json({ success: true, ...result });
}

// GET /api/products/options
export function getOptions(req, res) {
  res.json({ success: true, ...productService.getOptions() });
}

// GET /api/products/sku/:sku
export async function getProductBySku(req, res) {
  const product = await productService.getProductBySku(req.params.sku);
  res.json({ success: true, product });
}

// GET /api/products/:idOrSlug
export async function getProduct(req, res) {
  const product = await productService.getProduct(req.params.idOrSlug);
  res.json({ success: true, product });
}

// POST /api/products  (multipart/form-data, image files in "images")
export async function createProduct(req, res) {
  const product = await productService.createProduct(req.body, req.files);
  res.status(201).json({ success: true, product });
}

// PATCH /api/products/:id  (multipart/form-data, new files in "images", removeImages=["publicId"])
export async function updateProduct(req, res) {
  const product = await productService.updateProduct(req.params.id, req.body, req.files);
  res.json({ success: true, product });
}

// DELETE /api/products/:id
export async function deleteProduct(req, res) {
  await productService.deleteProduct(req.params.id);
  res.json({ success: true, message: "Product deleted" });
}
