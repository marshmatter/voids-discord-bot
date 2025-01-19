import mysql from 'mysql2/promise';
import { discordAuthMiddleware } from '../../../middleware/discordAuth';

export default async function handler(req, res) {
  // Check authentication first
  const authResult = await discordAuthMiddleware(req, res);
  if (!authResult.authorized) {
    return res.status(403).json({ error: authResult.error });
  }

  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    if (req.method === 'GET') {
      const [warnings] = await db.execute(`
        SELECT 
          w.id,
          w.user_id,
          w.moderator_id as issued_by,
          w.timestamp as issued_at,
          w.context,
          w.warning_id,
          COALESCE(pw.description, w.description) as warning_text
        FROM warnings w
        LEFT JOIN predefined_warnings pw ON w.warning_id = pw.id
        ORDER BY w.timestamp DESC
      `);
      
      // Format the response
      const formattedWarnings = warnings.map(warning => ({
        ...warning,
        issued_at: new Date(warning.issued_at).toISOString(),
        // You might want to add any additional formatting here
      }));

      res.status(200).json(formattedWarnings);
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  } finally {
    await db.end();
  }
} 