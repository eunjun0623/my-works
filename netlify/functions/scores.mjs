// 네이버 스포츠의 KBO 일정/점수를 받아서 정리해 주는 서버 함수
// 주소: /api/scores
// ※ 네이버 비공식 경로라 나중에 구조가 바뀌면 이 파일을 고쳐야 할 수 있어요.

const DAY = 24 * 60 * 60 * 1000;
const ymd = d => d.toISOString().slice(0, 10);

function pick(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return '';
}

function normalize(g) {
  const dt = String(g.gameDateTime || '');
  const code = String(g.statusCode || '').toUpperCase();
  const info = String(g.statusInfo || '');
  const canceled = g.cancel === true || code === 'CANCEL' || /취소/.test(info);
  let state = 'before';
  if (canceled) state = 'cancel';
  else if (code === 'RESULT' || code === 'END') state = 'final';
  else if (['STARTED', 'LIVE', 'PLAYING', 'SUSPENDED'].includes(code)) state = 'live';

  return {
    id: g.gameId,
    date: pick(g.gameDate, dt.slice(0, 10)),
    time: dt.slice(11, 16),
    state,
    statusText: info,
    stadium: pick(g.stadium),
    winner: pick(g.winner),
    away: {
      name: pick(g.awayTeamName, g.awayTeamShortName),
      score: g.awayTeamScore ?? null,
      starter: pick(g.awayStarterName, g.awayStarter?.name, g.awayStarterPlayerName, g.awayCurrentPitcherName && state === 'before' ? g.awayCurrentPitcherName : ''),
    },
    home: {
      name: pick(g.homeTeamName, g.homeTeamShortName),
      score: g.homeTeamScore ?? null,
      starter: pick(g.homeStarterName, g.homeStarter?.name, g.homeStarterPlayerName, g.homeCurrentPitcherName && state === 'before' ? g.homeCurrentPitcherName : ''),
    },
  };
}

export default async () => {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = ymd(kstNow);
  const until = ymd(new Date(kstNow.getTime() + 21 * DAY));
  const url = 'https://api-gw.sports.naver.com/schedule/games'
    + '?fields=basic,schedule,baseball&upperCategoryId=kbaseball&categoryId=kbo'
    + `&fromDate=${today}&toDate=${until}&size=500`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://m.sports.naver.com/',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) throw new Error('naver ' + res.status);
    const data = await res.json();
    const games = (data?.result?.games || []).map(normalize).filter(g => g.date && g.home.name);
    games.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    const todayGames = games.filter(g => g.date === today);
    const nextDate = games.find(g => g.date > today && g.state !== 'cancel')?.date || null;
    const nextGames = nextDate ? games.filter(g => g.date === nextDate) : [];

    return new Response(JSON.stringify({ today, todayGames, nextDate, nextGames }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=20',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
};

export const config = { path: '/api/scores' };
