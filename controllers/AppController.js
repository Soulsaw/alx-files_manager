import redisClient from '../utils/redis';
import dbClient from '../utils/db';

exports.getStatus = (req, res) => {
  if (redisClient.isAlive() && dbClient.isAlive()) {
    res.status(200).json({ redis: true, db: true });
  }
};

exports.getStats = async (req, res) => {
  try {
    const users = await dbClient.nbUsers();
    const files = await dbClient.nbFiles();
    res.status(200).json({ users: users, files: files });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
};
