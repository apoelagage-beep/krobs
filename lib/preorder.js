export const CAMPAIGN = 'block-01-preorder-2026';
export const TARGET = 50;

export function campaignState(paid, deadlineValue, now = Date.now()) {
  const deadline = typeof deadlineValue === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(deadlineValue)
    ? Date.parse(deadlineValue) : NaN;
  const configured = Number.isFinite(deadline);
  const goalReached = paid >= TARGET;
  const open = configured && now < deadline && !goalReached;
  return { campaign: CAMPAIGN, target: TARGET, paid, goalReached, open,
    deadline: configured ? new Date(deadline).toISOString() : null,
    status: goalReached ? 'goal_reached' : !configured ? 'not_configured' : open ? 'open' : 'closed' };
}

export async function preorderState(sql) {
  const rows = await sql`
    SELECT COALESCE(SUM((item->>'q')::int), 0)::int AS paid
    FROM krobs_orders o
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(o.cart, '[]'::jsonb)) item
    WHERE o.preorder_campaign=${CAMPAIGN} AND o.payment_status='paid'
      AND item->>'t'='d'
      AND NOT EXISTS (
        SELECT 1 FROM krobs_payment_refunds r
        WHERE r.payment_intent=o.stripe_payment_intent AND r.fully_refunded=TRUE
      )
  `;
  return campaignState(Number(rows[0]?.paid || 0), process.env.KROBS_PREORDER_DEADLINE);
}
