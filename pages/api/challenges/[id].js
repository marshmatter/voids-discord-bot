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
      const { title, status } = req.body;

      // Update the challenge
      await db.execute(
        'UPDATE challenges SET theme = ?, state = ? WHERE id = ?',
        [title, status, id]
      );

      res.status(200).json({ message: 'Challenge updated successfully' });
    } 
    else if (req.method === 'DELETE') {
      // Deactivate the challenge instead of deleting
      await db.execute(
        'UPDATE challenges SET active = 0 WHERE id = ?',
        [id]
      );

      res.status(200).json({ message: 'Challenge deactivated successfully' });
    }
    else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  } finally {
    await db.end();
  }
} 