const { MongoClient } = require('mongodb');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '27017';
const DB_DATABASE = process.env.DB_DATABASE || 'files_manager';
const uri = `mongodb://${DB_HOST}:${DB_PORT}`;

class DBClient {
  constructor() {
    this.client = MongoClient(uri, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    });
    this.dbName = DB_DATABASE;
    this.db = null;
  }

  isAlive() {
    try {
      this.client.connect();
      this.db = this.client.db(this.dbName);
      return true;
    } catch (error) {
      this.client.close();
      return false;
    }
  }

  async nbUsers() {
    try {
      const count = await this.db.collection('users').countDocuments();
      return count;
    } catch (error) {
      console.error('Failed to get number of users', error);
      throw error;
    }
  }

  async nbFiles() {
    try {
      const count = await this.db.collection('files').countDocuments();
      return count;
    } catch (error) {
      console.error('Failed to get number of users', error);
      throw error;
    }
  }
}
const dbClient = new DBClient();
module.exports = dbClient;
