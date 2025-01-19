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
      const [warnings] = await db.execute('SELECT * FROM predefined_warnings');
      res.status(200).json(warnings);
    } 
    else if (req.method === 'POST') {
      const { description } = req.body;
      await db.execute(
        'INSERT INTO predefined_warnings (description) VALUES (?)',
        [description]
      );
      res.status(201).json({ message: 'Warning created successfully' });
    }

    if (req.socket.server.io) {
      req.socket.server.io.emit('warningUpdate', {
        type: req.method.toLowerCase(),
        warning: req.body
      });
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  } finally {
    await db.end();
  }
} 