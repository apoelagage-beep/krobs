const CATEGORY_ORDER = [
  'T-SHIRTS',
  'SWEATS & HOODIES',
  'CASQUETTES',
  'BONNETS',
  'CHAUSSETTES',
  'AUTRES'
];

function getTextileCategory(name = '') {
  const value = name.toLowerCase();
  if (value.includes('t-shirt') || value.includes('tshirt') || value.includes('tee')) return 'T-SHIRTS';
  if (value.includes('hoodie') || value.includes('sweat')) return 'SWEATS & HOODIES';
  if (value.includes('cap') || value.includes('casquette')) return 'CASQUETTES';
  if (value.includes('beanie') || value.includes('bonnet')) return 'BONNETS';
  if (value.includes('sock') || value.includes('chaussette')) return 'CHAUSSETTES';
  return 'AUTRES';
}

function groupTextileCards() {
  const grid = document.querySelector('#textile-grid');
  if (!grid) return;

  const cards = [...grid.querySelectorAll('.textile-card')];
  if (!cards.length || grid.querySelector('.textile-category-title')) return;

  const groups = new Map();
  for (const card of cards) {
    const name = card.querySelector('h3')?.textContent?.trim() || '';
    const category = getTextileCategory(name);
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(card);
  }

  grid.innerHTML = '';

  for (const category of CATEGORY_ORDER) {
    const items = groups.get(category);
    if (!items?.length) continue;

    const title = document.createElement('div');
    title.className = 'textile-category-title';
    title.style.gridColumn = '1 / -1';
    title.style.margin = grid.children.length ? '44px 0 8px' : '0 0 8px';
    title.style.padding = '0 0 14px';
    title.style.borderBottom = '2px solid #080808';
    title.style.fontFamily = 'monospace';
    title.style.fontWeight = '900';
    title.style.fontSize = '18px';
    title.style.letterSpacing = '2px';
    title.textContent = `${category} / ${items.length}`;
    grid.appendChild(title);

    items
      .sort((a, b) => {
        const an = a.querySelector('h3')?.textContent || '';
        const bn = b.querySelector('h3')?.textContent || '';
        return an.localeCompare(bn, 'fr');
      })
      .forEach((card) => grid.appendChild(card));
  }
}

const textileGridForCategories = document.querySelector('#textile-grid');
if (textileGridForCategories) {
  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(groupTextileCards);
  });
  observer.observe(textileGridForCategories, { childList: true });
  groupTextileCards();
}
