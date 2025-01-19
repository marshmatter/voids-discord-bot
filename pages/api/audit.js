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
      const [logs] = await db.execute(`
        SELECT * FROM audit_logs 
        ORDER BY timestamp DESC 
        LIMIT 100
      `);
      
      res.status(200).json(logs);
    } 
    else if (req.method === 'POST') {
      const { action_type, description, user_id, metadata } = req.body;
      
      await db.execute(
        'INSERT INTO audit_logs (action_type, description, user_id, metadata) VALUES (?, ?, ?, ?)',
        [action_type, description, user_id, JSON.stringify(metadata)]
      );

      // Emit socket event for real-time updates
      if (req.socket.server.io) {
        req.socket.server.io.emit('auditLog', { action_type, description, user_id, metadata });
      }

      res.status(201).json({ message: 'Audit log created' });
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  } finally {
    await db.end();
  }
} 