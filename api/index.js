import fetch from 'node-fetch';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { category = 'all', offset = '0', limit = '10', year } = req.query;
  const targetYear = parseInt(year) || new Date().getFullYear();
  const apiCategory = category === 'all' ? 'all_news' : category;
  const requestedLimit = parseInt(limit);
  const requestedOffset = parseInt(offset);
  
  let allNews = [];
  const headers = {
    'authority': 'inshorts.com',
    'accept': '*/*',
    'content-type': 'application/json',
    'referer': 'https://inshorts.com/en/read',
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
  };

  // Fetch a larger batch initially to get the latest news
  const batchSize = Math.max(50, requestedLimit * 3); // Fetch more to ensure we get latest
  let currentOffset = 0;
  
  try {
    // Keep fetching until we have enough news or no more news available
    while (allNews.length < (requestedOffset + requestedLimit)) {
      const apiUrl = `https://inshorts.com/api/en/news?category=${apiCategory}&max_limit=${batchSize}&include_card_data=true&offset=${currentOffset}`;
      
      const response = await fetch(apiUrl, { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      const newsList = result?.data?.news_list || [];
      
      if (!newsList.length) break;
      
      // Process news items
      const processedNews = [];
      for (const entry of newsList) {
        const news = entry.news_obj;
        if (!news) continue;
        
        const timestamp = news.created_at / 1000;
        const articleDate = new Date(timestamp * 1000);
        
        // Skip if not from target year
        if (articleDate.getFullYear() !== targetYear) continue;
        
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
        
        processedNews.push({
          id: crypto.randomUUID(),
          title: news.title || '',
          imageUrl: news.image_url || '',
          url: news.shortened_url || '',
          content: news.content || '',
          author: news.author_name || '',
          date: formattedDate,
          time: istTime.toLowerCase(),
          readMoreUrl: news.source_url || '',
          timestamp: news.created_at, // Keep original timestamp for sorting
        });
      }
      
      // Add to allNews array
      allNews.push(...processedNews);
      
      // Sort by timestamp (latest first) to ensure we have the most recent news
      allNews.sort((a, b) => b.timestamp - a.timestamp);
      
      // Remove duplicates based on title or URL
      const seen = new Set();
      allNews = allNews.filter(item => {
        const key = item.title + item.url;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      // If we have enough news or the batch returned less than expected, break
      if (allNews.length >= (requestedOffset + requestedLimit) || newsList.length < batchSize) {
        break;
      }
      
      currentOffset += batchSize;
    }
    
    // Apply offset and limit to the sorted results
    const startIndex = requestedOffset;
    const endIndex = requestedOffset + requestedLimit;
    const finalNews = allNews.slice(startIndex, endIndex);
    
    // Remove timestamp from final response
    const cleanedNews = finalNews.map(({ timestamp, ...news }) => news);
    
    return res.status(200).json({
      success: !!cleanedNews.length,
      category,
      year: targetYear,
      total: allNews.length,
      showing: cleanedNews.length,
      data: cleanedNews,
      ...(cleanedNews.length === 0 ? { error: `No news found for year ${targetYear}` } : {}),
    });
    
  } catch (err) {
    console.error('❌ Error fetching news:', err);
    return res.status(500).json({ 
      error: 'Failed to fetch news data',
      details: err.message 
    });
  }
}
