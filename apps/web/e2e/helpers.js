/** Parses a rendered "RM 2,399" / "RM 1460.00" / "RM -939" string into a number. */
export function parseRM(text) {
  const cleaned = String(text).replace(/RM\s?/i, '').replace(/,/g, '').trim();
  return parseFloat(cleaned);
}

/**
 * Reads the value shown in a Carbon Tile-style stat card: a value element
 * immediately followed by a sibling label element containing exact text
 * `label`. Used on Dashboard and Cash Flow, which both render
 * `<div>{value}</div><div>{label}</div>` pairs inside a Tile.
 */
export async function readStat(page, label) {
  const labelEl = page.getByText(label, { exact: true });
  const valueEl = labelEl.locator('xpath=preceding-sibling::*[1]');
  const text = await valueEl.innerText();
  return parseRM(text);
}
