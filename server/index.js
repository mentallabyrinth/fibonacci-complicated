const express = require("express");
const redis = require("redis");
const cors = require("cors");
const bodyParser = require("body-parser");
const keys = require("./keys");

// Express application setup
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Setup Postgres client setup
const { Pool } = require("pg");

const pgClient = new Pool({
  host: keys.pgHost,
  port: keys.pgPort,
  user: keys.pgUsername,
  password: keys.pgPassword,
  database: keys.pgDatabase
});

pgClient.on("error", () => console.log("Lost PG connection"));

pgClient
  .query("CREATE TABLE IF NOT EXISTS values (number INT)")
  .catch((err) => console.log(err));

// Setup Redis client
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate();

// Express route handlers
app.get("/", (req, res) => {
  res.send("I'm alive!");
});

app.get("/values/all", async (req, res) => {
  const values = await pgClient.query("SELECT * FROM VALUES");
  res.send(values.rows);
});

app.get("/values/current", async (req, res) => {
  redisClient.hgetall("values", (err, values) => {
    res.send(values);
  });
});

app.post("/values", async (req, res) => {
  const index = req.body.index;
  if (parseInt(index) > 40)
    return res.status(422).send("Index too high!");

  redisClient.hset("values", index, "Nothing yet!");
  redisPublisher.publish("insert", index);
  pgClient.query("INSERT INTO VALUES (number) VALUES ($1)", [index]);

  res.send({ working: true });
});

app.listen(5000, error => {
  if (error) {
    console.log(error);
  }
  console.log("Listening...");
})