import dbClient from '../utils/db';

const crypto = require('crypto');

exports.postNew = async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Missing email' });
  }
  if (!password) {
    res.status(400).json({ error: 'Missing password' });
  }
  if (!dbClient.isAlive()) {
    res.status(400).json({ error: 'Mongo server error' });
  } else {
    const collection = dbClient.db.collection('users');
    const exists = await collection.findOne({ email });
    if (exists) {
      res.status(400).json({ error: 'Already exist' });
    } else {
      const hashPassword = crypto.createHash('sha1').update(password).digest('hex');
      const insertUser = await collection.insertOne({ email, password: hashPassword });
      const result = insertUser.ops[0];
      res.status(201).json({ id: result._id, email: result.email });
    }
  }
};
