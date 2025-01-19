import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    if (req.method === 'GET') {
      const [settings] = await db.execute(
        'SELECT settings FROM dashboard_settings WHERE user_id = ?',
        [req.query.userId]
      );
      
      res.status(200).json(settings[0]?.settings || {});
    } 
    else if (req.method === 'POST') {
      const { userId, settings } = req.body;
      
      await db.execute(
        'INSERT INTO dashboard_settings (user_id, settings) VALUES (?, ?) ON DUPLICATE KEY UPDATE settings = ?',
        [userId, JSON.stringify(settings), JSON.stringify(settings)]
      );

      res.status(200).json({ message: 'Settings updated' });
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  } finally {
    await db.end();
  }
} 