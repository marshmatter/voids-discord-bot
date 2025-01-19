import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  const envPath = path.join(process.cwd(), '.env');

  if (req.method === 'GET') {
    try {
      const envContent = await fs.readFile(envPath, 'utf-8');
      const envVars = {};
      
      envContent.split('\n').forEach(line => {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split('=');
          if (key && value) {
            envVars[key.trim()] = value.trim();
          }
        }
      });

      res.status(200).json(envVars);
    } catch (error) {
      res.status(500).json({ error: 'Failed to read .env file' });
    }
  } 
  
  else if (req.method === 'POST') {
    try {
      const { key, value } = req.body;
      
      let envContent = await fs.readFile(envPath, 'utf-8');
      const envLines = envContent.split('\n');
      
      const keyIndex = envLines.findIndex(line => 
        line.startsWith(`${key}=`)
      );

      if (keyIndex !== -1) {
        envLines[keyIndex] = `${key}=${value}`;
      } else {
        envLines.push(`${key}=${value}`);
      }

      await fs.writeFile(envPath, envLines.join('\n'));
      if (req.socket.server.io) {
        req.socket.server.io.emit('envUpdate', {
          key,
          value: isSensitiveField(key) ? '******' : value
        });
      }
      res.status(200).json({ message: 'Updated successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update .env file' });
    }
  }
} 