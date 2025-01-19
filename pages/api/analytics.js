import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [warningStats] = await db.execute(`
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as count
      FROM warnings
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
      LIMIT 30
    `);

    const [challengeStats] = await db.execute(`
      SELECT 
        state,
        COUNT(*) as count
      FROM challenges
      GROUP BY state
    `);

    const [moderatorStats] = await db.execute(`
      SELECT 
        moderator_id,
        COUNT(*) as warning_count
      FROM warnings
      GROUP BY moderator_id
      ORDER BY warning_count DESC
      LIMIT 5
    `);

    res.status(200).json({
      warningTrends: warningStats,
      challengeDistribution: challengeStats,
      topModerators: moderatorStats
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  } finally {
    await db.end();
  }
} 