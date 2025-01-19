import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  const { id } = req.query;
  
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    if (req.method === 'PUT') {
      const { description } = req.body;
      await db.execute(
        'UPDATE predefined_warnings SET description = ? WHERE id = ?',
        [description, id]
      );
      res.status(200).json({ message: 'Warning updated successfully' });
    } 
    else if (req.method === 'DELETE') {
      await db.execute(
        'DELETE FROM predefined_warnings WHERE id = ?',
        [id]
      );
      res.status(200).json({ message: 'Warning deleted successfully' });
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  } finally {
    await db.end();
  }
} 