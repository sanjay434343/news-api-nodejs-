import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/api/news', async (req, res) => {
  const { limit = '10', year } = req.query;
  const apiLimit = parseInt(limit);
  let apiOffset = 0;

  const currentYear = new Date().getFullYear();
  const targetYears = year
    ? [parseInt(year)]
    : [currentYear, currentYear - 1, currentYear - 2];

  let allNews = [];

  const headers = {
    'authority': 'inshorts.com',
    'accept': '*/*',
    'content-type': 'application/json',
    'referer': 'https://inshorts.com/en/read',
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64)',
  };

  while (allNews.length < apiLimit) {
    const apiUrl = `https://inshorts.com/api/en/news?category=all_news&max_limit=${apiLimit}&include_card_data=true&offset=${apiOffset}`;

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

  allNews.sort((a, b) => b.rawTimestamp - a.rawTimestamp);
  const finalNews = allNews.slice(0, apiLimit).map(({ rawTimestamp, ...rest }) => rest);

  return res.status(200).json({
    success: !!finalNews.length,
    year: year || `Last 3 years (${targetYears.join(', ')})`,
    data: finalNews,
    ...(finalNews.length === 0 ? { error: 'No news found for selected year(s)' } : {}),
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
