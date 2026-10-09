import { db, ensure } from './db.js';
import { preorderState } from '../lib/preorder.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const sql = db();
    await ensure(sql);
    return res.status(200).json(await preorderState(sql));
  } catch (error) {
    console.error('KROBS_PREORDERS_ERROR', error.message);
    return res.status(503).json({ error: 'Suivi des précommandes temporairement indisponible.' });
  }
}
