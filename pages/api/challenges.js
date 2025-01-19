import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  // Create the database connection
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    if (req.method === 'GET') {
      // Updated query to get all challenges
      const [challenges] = await db.execute(
        'SELECT id, theme as title, state as status, submissions_close as created, active FROM challenges ORDER BY id DESC'
      );

      // Format the data for the dashboard
      const formattedChallenges = challenges.map(challenge => ({
        ...challenge,
        status: challenge.active ? (challenge.status || 'Submissions') : 'Inactive',
        created: challenge.created || new Date().toISOString(),
        isActive: !!challenge.active
      }));

      res.status(200).json(formattedChallenges);

    } else if (req.method === 'DELETE') {
      const { id } = req.query;
      
      // Instead of deleting, we'll set active = 0
      await db.execute(
        'UPDATE challenges SET active = 0 WHERE id = ?',
        [id]
      );

      if (req.socket.server.io) {
        req.socket.server.io.emit('challengeUpdate', {
          type: 'delete',
          id
        });
      }

      res.status(200).json({ message: 'Challenge deactivated successfully' });
    } else if (req.method === 'POST') {
      const { title, description, submissionsClose, votingBegins, votingEnds } = req.body;
      
      try {
        await db.execute(
          'INSERT INTO challenges (theme, description, submissions_close, voting_begins, voting_ends, state, active) VALUES (?, ?, ?, ?, ?, "Submissions", 1)',
          [title, description, submissionsClose, votingBegins, votingEnds]
        );

        if (req.socket.server.io) {
          req.socket.server.io.emit('challengeUpdate', {
            type: 'create',
            challenge: {
              id: db.connection.threadId,
              title,
              description,
              submissionsClose,
              votingBegins,
              votingEnds,
              status: 'Submissions',
              created: new Date().toISOString(),
              isActive: true
            }
          });
        }

        res.status(201).json({ message: 'Challenge created successfully' });
      } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Failed to create challenge' });
      }
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  } finally {
    await db.end();
  }
} 