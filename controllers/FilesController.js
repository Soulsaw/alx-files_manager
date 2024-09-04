import dbClient from "../utils/db";
import redisClient from "../utils/redis";
const { ObjectId } = require("mongodb");

exports.postUpload = async (req, res) => {
  const token = req.headers["x-token"];
  const key = `auth_${token}`;
  const userId = await redisClient.get(key);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
  }
  if (!dbClient.isAlive()) {
    res.status(401).json({ error: "Unauthorized" });
  } else {
    const collection = dbClient.db.collection("users");
    const user = await collection.findOne({ _id: ObjectId(userId) });
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
    } else {
        
    }
  }
};
