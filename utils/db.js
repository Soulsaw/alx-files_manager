const { MongoClient } = require('mongodb');

const DB_HOST = process.env.DB_HOST !== undefined ? process.env.DB_HOST : 'localhost';
const DB_PORT = process.env.DB_PORT !== undefined ? process.env.DB_PORT : '27017';
const DB_DATABASE = process.env.DB_DATABASE !== undefined ? process.env.DB_DATABASE : 'files_manager';
const url = `mongodb://${DB_HOST}:${DB_PORT}`;

class DBClient {
  constructor() {
    this.client = MongoClient(url);
  }

  isAlive() {
    try {
      this.client.connect();
      return true;
    } catch (err) {
      return false;
    }
  }

  async nbUsers() {
    await this.client.connect();
    const db = this.client.db(DB_DATABASE);
    const collection = db.collection('users');
    return collection.length;
  }

  async nbFiles() {
    await this.client.connect();
    const db = this.client.db(DB_DATABASE);
    const collection = db.collection('files');
    return collection.length;
  }
}
const dbClient = new DBClient();
module.exports = dbClient;
