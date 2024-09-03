const express = require('express');
const router = require('./routes/index');

const app = express();
const port = process.env.PORT || 5000;

app.use(router);
app.use(express.json());

app.listen(port, () => {
  console.log(`Server express is running on:${port}`);
});

module.exports = app;
