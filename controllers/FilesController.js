import dbClient from '../utils/db';
import redisClient from '../utils/redis';
/* The files controller */

const { ObjectId } = require('mongodb');
const uuid = require('uuid');
const fs = require('fs');

exports.postUpload = async (req, res) => {
  const token = req.headers['x-token'];
  const { name, type, data } = req.body;
  const { isPublic = false, parentId = 0 } = req.body;
  const authTypes = ['file', 'folder', 'image'];
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
  if (!type || !authTypes.includes(type)) {
    return res.status(400).json({ error: 'Missing type' });
  }
  if (!data && type !== 'folder') {
    return res.status(400).json({ error: 'Missing data' });
  }
  if (!dbClient.isAlive()) {
    return res.status(400).json({ error: 'Database not connected' });
  }
  const collectionF = dbClient.db.collection('files');
  if (parentId !== 0) {
    const file = await collectionF.findOne({ _id: ObjectId(parentId) });
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
  const { parentId = 0 } = req.query;
  const page = parseInt(req.query.page, 10) || 0;
  const userId = await redisClient.get(`auth_${token}`);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!dbClient.isAlive()) {
    return res.status(401).json({ error: 'Database not connected' });
  }
  const usersCollection = dbClient.db.collection('users');
  const user = await usersCollection.findOne({ _id: ObjectId(userId) });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  let files;
  if (parentId === 0 && page === 0) {
    files = await dbClient.db
      .collection('files')
      .aggregate([
        {
          $match: { userId: ObjectId(user._id) },
        },
      ])
      .toArray();
  } else {
    files = await dbClient.db
      .collection('files')
      .aggregate([
        {
          $match: { userId: ObjectId(user._id), parentId },
        },
        {
          $skip: page * 20,
        },
        {
          $limit: 20,
        },
      ])
      .toArray();
  }
  return res.json(
    files.map((file) => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    })),
  );
};

exports.putPublish = async (req, res) => {
  const token = req.headers['x-token'];
  const userId = await redisClient.get(`auth_${token}`);
  const { id } = req.query;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!dbClient.isAlive()) {
    return res.status(401).json({ error: 'Database not connected' });
  }
  const usersCollection = dbClient.db.collection('users');
  const user = await usersCollection.findOne({ _id: ObjectId(userId) });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const filesCollection = dbClient.db.collections('files');

  const updateFile = await filesCollection.updateOne(
    { _id: ObjectId(id), userId: ObjectId(user._id) },
    { $set: { isPublic: true } },
  );
  if (!updateFile) return res.status(404).json({ error: 'Not found' });
  return res.status(200).json({
    id: updateFile._id,
    userId: updateFile.userId,
    name: updateFile.name,
    type: updateFile.type,
    isPublic: updateFile.isPublic,
    parentId: updateFile.parentId,
  });
};

exports.putUnpublish = async (req, res) => {
  const token = req.headers['x-token'];
  const userId = await redisClient.get(`auth_${token}`);
  const { id } = req.query;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!dbClient.isAlive()) {
    return res.status(401).json({ error: 'Database not connected' });
  }
  const usersCollection = dbClient.db.collection('users');
  const user = await usersCollection.findOne({ _id: ObjectId(userId) });
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const filesCollection = dbClient.db.collections('files');

  const updateFile = await filesCollection.updateOne(
    { _id: ObjectId(id), userId: ObjectId(user._id) },
    { $set: { isPublic: false } },
  );
  if (!updateFile) return res.status(404).json({ error: 'Not found' });
  return res.status(200).json({
    id: updateFile._id,
    userId: updateFile.userId,
    name: updateFile.name,
    type: updateFile.type,
    isPublic: updateFile.isPublic,
    parentId: updateFile.parentId,
  });
};
