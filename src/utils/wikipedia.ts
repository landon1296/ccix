/**
 * Fetches the NASCAR Cup Series all-time wins leaderboard from Wikipedia.
 * Uses the MediaWiki parse API (CORS-enabled) so data stays current.
 */

export interface WikiNascarDriver {
  rank: number;
  name: string;
  wins: number;
  isActive: boolean;
}

const WIKI_PAGE = 'List_of_all-time_NASCAR_Cup_Series_winners';
const CACHE_KEY = 'wiki_nascar_alltime_wins';
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

/** Return cached data if still fresh */
function getCached(): WikiNascarDriver[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, drivers } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL) return drivers as WikiNascarDriver[];
  } catch { /* ignore */ }
  return null;
}

function setCache(drivers: WikiNascarDriver[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), drivers }));
  } catch { /* quota exceeded – ignore */ }
}

/**
 * Fetch and parse the Wikipedia all-time wins table.
 * Falls back gracefully on network/parse errors.
 */
export async function fetchNascarAllTimeWins(): Promise<WikiNascarDriver[]> {
  const cached = getCached();
  if (cached) return cached;

  const url =
    `https://en.wikipedia.org/w/api.php?action=parse&page=${WIKI_PAGE}&prop=wikitext&format=json&origin=*`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Wikipedia API error: ${resp.status}`);

  const json = await resp.json();
  const wikitext: string = json?.parse?.wikitext?.['*'] ?? '';
  if (!wikitext) throw new Error('Empty wikitext from Wikipedia');

  const drivers = parseWikitext(wikitext);
  if (drivers.length > 0) setCache(drivers);
  return drivers;
}

/** Parse the sortable wikitable from raw wikitext */
function parseWikitext(wt: string): WikiNascarDriver[] {
  // Find the main sortable wikitable (the one with driver wins data)
  const tableStart = wt.indexOf('{| class="wikitable sortable');
  if (tableStart === -1) return [];

  const tableText = wt.substring(tableStart);
  const tableEnd = tableText.indexOf('\n|}', 100);
  const table = tableEnd === -1 ? tableText : tableText.substring(0, tableEnd);

  const rows = table.split('|-');
  const drivers: WikiNascarDriver[] = [];

  // Skip header rows (first two elements after split)
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const lines = row.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    // Rank: "! 1" or "! 23"
    const rankMatch = lines[0].match(/!\s*(\d+)/);
    if (!rankMatch) continue;
    const rank = parseInt(rankMatch[1], 10);

    // Join remaining lines and split by || to get columns
    const content = lines.slice(1).join(' ');
    const cols = content.split('||');
    if (cols.length < 2) continue;

    const nameCol = cols[0];

    // Extract driver name from {{sortname|First|Last}} or [[Name]] or [[Name|Display]]
    let name = '';
    const sortnameMatch = nameCol.match(/sortname\|([^|]+)\|([^|}]+)/);
    if (sortnameMatch) {
      name = `${sortnameMatch[1].trim()} ${sortnameMatch[2].trim()}`;
    } else {
      const linkMatch = nameCol.match(/\[\[([^|\]]+?)(?:\|[^\]]+)?\]\]/);
      if (linkMatch) {
        name = linkMatch[1].trim();
      } else {
        continue; // Can't extract name – skip row
      }
    }

    // Active status: green background = full-time, yellow = part-time
    const isActive =
      nameCol.includes('background:#90ff90') || nameCol.includes('background:#ff9');

    // Combined total is the last column value
    const lastCol = cols[cols.length - 1].trim();
    let wins = 0;
    // Could be [[List...|200]] or plain "85" or "85{{efn|...}}"
    const pipeLink = lastCol.match(/\|(\d+)\]\]/);
    if (pipeLink) {
      wins = parseInt(pipeLink[1], 10);
    } else {
      const plainNum = lastCol.match(/(\d+)/);
      if (plainNum) wins = parseInt(plainNum[1], 10);
    }

    if (name && wins > 0) {
      drivers.push({ rank, name, wins, isActive });
    }
  }

  return drivers;
}
