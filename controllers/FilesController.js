import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const { ObjectId } = require('mongodb');
const uuid = require('uuid');
const fs = require('fs');

exports.postUpload = async (req, res) => {
  const token = req.headers['x-token'];
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
  }
  if (!dbClient.isAlive()) {
    res.status(401).json({ error: 'Unauthorized' });
  } else {
    const collection = dbClient.db.collection('users');
    const user = await collection.findOne({ _id: ObjectId(userId) });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
    } else {
      const { name, type, data } = req.body;
      let { isPublic, parentId } = req.body;
      if (!name) res.status(400).json({ error: 'Missing name' });
      if (!type) res.status(400).json({ error: 'Missing type' });
      if (!data && type !== 'folder') {
        res.status(400).json({ error: 'Missing data' });
      }
      if (!isPublic) isPublic = false;
      if (!dbClient.isAlive()) {
        res.status(400).json({ error: 'Database not connected' });
      }
      const collection = dbClient.db.collection('files');
      if (parentId) {
        const file = await collection.findOne({ parentId });
        if (!file) res.status(400).json({ error: 'Parent not found' });
        if (file && file.type !== 'folder') {
          res.status(400).json({ error: 'Parent is not a folder' });
        }
      }
      if (!parentId) parentId = 0;
      if (type === 'folder') {
        const document = {
          name,
          type,
          isPublic,
          parentId,
          userId: user._id,
        };
        const newFile = await collection.insertOne(document);
        const json = {
          id: newFile.ops[0]._id,
          userId: newFile.ops[0].userId,
          name: newFile.ops[0].name,
          type: newFile.ops[0].type,
          isPublic: newFile.ops[0].isPublic,
          parentId: newFile.ops[0].parentId,
        };
        res.status(201).json(json);
      } else {
        const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';
        const filename = uuid.v4();
        const content = Buffer.from(data, 'base64').toString('utf-8');
        try {
          if (!fs.existsSync(FOLDER_PATH)) {
            fs.mkdirSync(FOLDER_PATH);
          }
          try {
            fs.writeFileSync(`${FOLDER_PATH}/${filename}`, content, (err) => {
              console.log('Error writing the file', err);
            });
          } catch (error) {
            console.log('Error writing the content', error);
          }
        } catch (error) {
          console.log('Error creating folder', error);
        }
        const localPath = `${FOLDER_PATH}/${filename}`;
        const document = {
          name,
          type,
          isPublic,
          parentId,
          userId: user._id,
          localPath,
        };
        const localFile = await collection.insertOne(document);
        const json = {
          id: localFile.ops[0]._id,
          userId: localFile.ops[0].userId,
          name: localFile.ops[0].name,
          type: localFile.ops[0].type,
          isPublic: localFile.ops[0].isPublic,
          parentId: localFile.ops[0].parentId,
        };
        res.status(201).json(json);
      }
    }
  }
};
