const PRINTFUL_API = 'https://api.printful.com';

export async function printfulRequest(path, options = {}) {
  const token = process.env.PRINTFUL_TOKEN;
  if (!token) throw new Error('PRINTFUL_TOKEN missing');

  const response = await fetch(`${PRINTFUL_API}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
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
    throw new Error(typeof message === 'string' ? message : `Printful API ${response.status}`);
  }

  return data;
}
