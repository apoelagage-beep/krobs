const PRINTFUL_API = 'https://api.printful.com';

export async function printfulRequest(path, options = {}) {
  const token = process.env.PRINTFUL_TOKEN;
  if (!token) throw new Error('PRINTFUL_TOKEN missing');

  const storeId = process.env.PRINTFUL_STORE_ID;

  const response = await fetch(`${PRINTFUL_API}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(storeId ? { 'X-PF-Store-Id': storeId } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.result || `Printful API ${response.status}`;
    const error = new Error(typeof message === 'string' ? message : `Printful API ${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

export async function createPrintfulDraftOrder(order) {
  return printfulRequest('/orders?confirm=false', {
    method: 'POST',
    body: order
  });
}
