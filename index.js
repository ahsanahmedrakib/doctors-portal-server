const express = require("express");
const app = express();
const cors = require("cors");
const admin = require("firebase-admin");
const port = process.env.PORT || 5000;
require("dotenv").config();
const { MongoClient } = require("mongodb");
const ObjectId = require('mongodb').ObjectId;


const serviceAccount = JSON.parse(process.env.FIREBASE_AUTH)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xdeet.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next){
  if(req.headers?.authorization?.startsWith('Bearer ')){
    const token = req.headers.authorization.split(' ')[1];
    try{
      const decodedUser =  await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    }
    catch{

    }
  
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("doctors");
    const appoinmentCollection = database.collection("appointments");
    const usersCollection = database.collection("users");

    app.get("/appointments", verifyToken, async (req, res) => {
      const email = req.query.email;
      const date = req.query.date;
      const query = { email: email, date: date };
      const cursor = appoinmentCollection.find(query);
      const appointments = await cursor.toArray();
      res.json(appointments);
    });

    app.get('/appointments/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id: ObjectId(id)}
      const result = await appoinmentCollection.findOne(query)
      res.json(result)
    })


    app.post("/appointments", async (req, res) => {
      const appointments = req.body;
      const result = await appoinmentCollection.insertOne(appointments);
      res.json(result);
    });

    app.post("/users", async (req, res) => {
      const users = req.body;
      const result = await usersCollection.insertOne(users);
      res.json(result);
    });

    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === 'admin') {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if(requester){
        const requesterAccount = await usersCollection.findOne({email: requester})
        if(requesterAccount.role === 'admin'){
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      }
      else{
        res.status(403).json({messag: 'You do not have access to make admin'});
      }
    });
  } finally {
    // await client.close()
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Doctors Portal");
});

app.listen(port, () => {
  console.log(`Doctor's Portal listening at http://localhost:${port}`);
});
