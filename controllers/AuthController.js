import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const crypto = require('crypto');
const uuid = require('uuid');

exports.getConnect = async (req, res) => {
  try {
    const { authorization } = req.headers;
    const tokens = authorization.split(' ');
    const basic = tokens[0];
    const token = tokens[1];
    if (basic === 'Basic') {
      if (token != null) {
        const credentials = Buffer.from(token, 'base64')
          .toString('utf-8')
          .split(':');
        const email = credentials[0];
        const password = credentials[1];

        if (!dbClient.isAlive()) {
          res.status(400).json({ error: 'Database connection error' });
        } else {
          const collection = dbClient.db.collection('users');
          const user = await collection.findOne({ email });
          if (user) {
            const hashed = crypto
              .createHash('sha1')
              .update(password)
              .digest('hex');
            if (hashed !== user.password) {
              res.status(401).json({ error: 'Unauthorized' });
            } else {
              const str = uuid.v4();
              const key = `auth_${str}`;
              await redisClient.set(key, user._id.toString(), 361440);
              res.status(200).json({ token: str });
            }
          } else {
            res.status(401).json({ error: 'Unauthorized' });
          }
        }
      }
    } else {
      res.status(501).json({ error: 'Unauthorized' });
    }
  } catch (err) {
    res.status(501).json({ error: 'Unauthorized' });
  }
};

exports.getDisconnect = async (req, res) => {
  try {
    const token = req.headers['x-token'];
    const key = `auth_${token}`;
    const result = await redisClient.get(key);
    if (result !== null) {
      await redisClient.del(key);
      res.status(204).json();
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
