import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { category, offset = '0', limit } = req.query;

  // Home/help message if category or limit is missing
  if (!category || !limit) {
    return res.status(200).json({
      message: '📰 Welcome to the Inshorts News API',
      usage: '/api?category=<category>&offset=<offset>&limit=<limit>',
      example: [
        '/api?category=all&limit=100',
        '/api?category=sports&offset=20&limit=50',
      ],
      note: '⚠️ "category" and "limit" are required query params',
    });
  }

  const currentYear = new Date().getFullYear();
  let apiCategory = category === 'all' ? 'all_news' : category;
  let allNews = [];
  let apiOffset = parseInt(offset);
  const apiLimit = parseInt(limit);

  const headers = {
    'authority': 'inshorts.com',
    'accept': '*/*',
    'accept-language': 'en-GB,en;q=0.5',
    'content-type': 'application/json',
    'referer': 'https://inshorts.com/en/read',
    'user-agent':
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
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
        const dtUTC = new Date(timestamp * 1000);

        if (dtUTC.getFullYear() !== currentYear) break;

        const istDate = new Date(timestamp * 1000).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        const formattedDate = dtUTC.toLocaleDateString('en-IN', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });

        allNews.push({
          id: crypto.randomUUID(),
          title: news.title || '',
          imageUrl: news.image_url || '',
          url: news.shortened_url || '',
          content: news.content || '',
          author: news.author_name || '',
          date: formattedDate,
          time: istDate.toLowerCase(),
          readMoreUrl: news.source_url || '',
        });

        if (allNews.length >= apiLimit) break;
      }

      if (newsList.length < apiLimit) break;
      apiOffset += apiLimit;
    } catch (err) {
      console.error('Error fetching news:', err);
      break;
    }
  }

  return res.status(200).json({
    success: !!allNews.length,
    category,
    data: allNews,
    ...(allNews.length === 0 ? { error: 'No news found for this year' } : {}),
  });
}
