import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { category, offset = '0', limit = '10', year } = req.query;

  if (!category) {
    return res.status(200).json({
      message: '📰 Welcome to the Inshorts News API',
      usage: '/api?category=top_stories&offset=0&limit=10',
      example: [
        '/api?category=all',
        '/api?category=business&offset=5&limit=10',
        '/api?category=technology&year=2023',
      ],
    });
  }

  const apiCategory = category === 'all' ? 'all_news' : category;
  const apiLimit = parseInt(limit);
  let apiOffset = parseInt(offset);

  const targetYears = year
    ? [parseInt(year)]
    : [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2];

  let allNews = [];

  const headers = {
    'authority': 'inshorts.com',
    'accept': '*/*',
    'content-type': 'application/json',
    'referer': 'https://inshorts.com/en/read',
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
  };

  while (allNews.length < apiLimit) {
    const apiUrl = `https://inshorts.com/api/en/news?category=${apiCategory}&max_limit=${apiLimit}&include_card_data=true&offset=${apiOffset}`;

    try {
      const response = await fetch(apiUrl, { headers });
      const result = await response.json();
      const newsList = result?.data?.news_list || [];

      if (!newsList.length) break;

      for (const entry of newsList) {
        const news = entry.news_obj;
        const timestamp = news.created_at / 1000;
        const articleDate = new Date(timestamp * 1000);
        const articleYear = articleDate.getFullYear();

        // Skip articles not in target years
        if (!targetYears.includes(articleYear)) continue;

        const formattedDate = articleDate.toLocaleDateString('en-IN', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });

        const istTime = articleDate.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        allNews.push({
          id: crypto.randomUUID(),
          title: news.title || '',
          imageUrl: news.image_url || '',
          url: news.shortened_url || '',
          content: news.content || '',
          author: news.author_name || '',
          date: formattedDate,
          time: istTime.toLowerCase(),
          readMoreUrl: news.source_url || '',
          rawTimestamp: timestamp,
        });

        if (allNews.length >= apiLimit) break;
      }

      if (newsList.length < apiLimit) break;
      apiOffset += apiLimit;
    } catch (err) {
      console.error('Error fetching news:', err);
      return res.status(500).json({ error: 'Failed to fetch news data' });
    }
  }

  // Sort by timestamp descending (newest first)
  allNews.sort((a, b) => b.rawTimestamp - a.rawTimestamp);

  // Remove rawTimestamp before returning
  const finalNews = allNews.slice(0, apiLimit).map(({ rawTimestamp, ...rest }) => rest);

  return res.status(200).json({
    success: !!finalNews.length,
    category,
    year: year || `Last 3 years (${targetYears.join(', ')})`,
    data: finalNews,
    ...(finalNews.length === 0 ? { error: 'No news found for selected year(s)' } : {}),
  });
}
