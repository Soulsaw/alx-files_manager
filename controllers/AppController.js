import redisClient from '../utils/redis';
import dbClient from '../utils/db';

exports.getStatus = (req, res) => {
  const redisStatus = redisClient.isAlive();
  const dbStatus = dbClient.isAlive();
  if (redisStatus && dbStatus) {
    return res.status(200).json({ redis: redisStatus, db: dbStatus });
  }
  return res.status(400).json({ redis: redisStatus, db: dbStatus });
};

exports.getStats = async (req, res) => {
  try {
    const users = await dbClient.nbUsers();
    const files = await dbClient.nbFiles();
    return res.status(200).json({ users, files });
  } catch (err) {
    return res.status(500).json({ error: 'Error' });
  }
};
