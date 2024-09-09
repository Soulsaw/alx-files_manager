import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const { ObjectId } = require('mongodb');
const uuid = require('uuid');
const fs = require('fs');

exports.postUpload = async (req, res) => {
  const token = req.headers['x-token'];
  const { name, type, data } = req.body;
  const { isPublic = false, parentId = 0 } = req.body;
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!dbClient.isAlive()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const collectionU = dbClient.db.collection('users');
  const user = await collectionU.findOne({ _id: ObjectId(userId) });
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!name) return res.status(400).json({ error: 'Missing name' });
  if (!type) return res.status(400).json({ error: 'Missing type' });
  if (!data && type !== 'folder') {
    return res.status(400).json({ error: 'Missing data' });
  }
  if (!dbClient.isAlive()) {
    return res.status(400).json({ error: 'Database not connected' });
  }
  const collectionF = dbClient.db.collection('files');
  if (parentId !== 0) {
    const file = await collectionF.findOne({ parentId });
    if (!file) return res.status(400).json({ error: 'Parent not found' });
    if (file && file.type !== 'folder') {
      return res.status(400).json({ error: 'Parent is not a folder' });
    }
  }
  if (type === 'folder') {
    const document = {
      name,
      type,
      isPublic,
      parentId,
      userId: user._id,
    };
    const newFile = await collectionF.insertOne(document);
    const json = {
      id: newFile.ops[0]._id,
      userId: newFile.ops[0].userId,
      name: newFile.ops[0].name,
      type: newFile.ops[0].type,
      isPublic: newFile.ops[0].isPublic,
      parentId: newFile.ops[0].parentId,
    };
    return res.status(201).json(json);
  }
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
  const localFile = await collectionF.insertOne(document);
  const json = {
    id: localFile.ops[0]._id,
    userId: localFile.ops[0].userId,
    name: localFile.ops[0].name,
    type: localFile.ops[0].type,
    isPublic: localFile.ops[0].isPublic,
    parentId: localFile.ops[0].parentId,
  };
  return res.status(201).json(json);
};

exports.getShow = async (req, res) => {
  const { id } = req.params;
  const token = req.headers['x-token'];
  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!dbClient.isAlive()) {
    return res.status(401).json({ error: 'Database not connected' });
  }
  const usersCollection = dbClient.db.collection('users');
  const user = await usersCollection.findOne({ _id: ObjectId(userId) });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const filesCollection = dbClient.db.collection('files');
  const file = await filesCollection.findOne({
    userId: ObjectId(user._id),
    _id: ObjectId(id),
  });
  if (!file) return res.status(404).json({ error: 'Not found' });
  const doc = {
    id: file._id,
    userId: file.userId,
    name: file.name,
    type: file.type,
    isPublic: file.isPublic,
    parentId: file.parentId,
  };
  return res.json(doc);
};

exports.getIndex = async (req, res) => {
  const token = req.headers['x-token'];
  const { parentId } = req.query;
  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!dbClient.isAlive()) {
    return res.status(401).json({ error: 'Database not connected' });
  }
  const usersCollection = dbClient.db.collection('users');
  const user = await usersCollection.findOne({ _id: ObjectId(userId) });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const filesCollection = dbClient.db.collection('files');
  let files;
  if (parentId) {
    files = await filesCollection
      .find({ userId: ObjectId(user._id), parentId })
      .toArray();
  } else {
    files = await filesCollection
      .find({ userId: ObjectId(user._id) })
      .toArray();
  }
  return res.json(files);
};
