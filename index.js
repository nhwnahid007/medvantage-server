const express = require("express");
const cors = require("cors");
var jwt = require("jsonwebtoken");
require("dotenv").config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);


const app = express();
const port = process.env.PORT || 5000;

//middelware

app.use(cors());
app.use(express.json());

//mongodb

const {
  MongoClient,
  ServerApiVersion,
  Timestamp,
  ObjectId,
} = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.omy4kgv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("medvantage").collection("users");
    const categoryCollection = client.db("medvantage").collection("categories");
    const medicineCollection = client.db("medvantage").collection("medicines");
    const cartCollection = client.db("medvantage").collection("carts");

    const paymentCollection = client.db("medvantage").collection("payments");


    //jwt related api

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });
      res.send({ token });
    });

    //verify token middleware

    const verifyToken = (req, res, next) => {
      console.log("Inside verify token ", req.headers.authorization);

      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }

      const token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;

        next();
      });
    };

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    //user related api
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send(result);
    });
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = {
        email: email,
      };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.put("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      //check if the already exist in the database
      const isExist = await userCollection.findOne(query);
      if (isExist) {
        return res.send({ message: "User aleready exist" });
      }
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...user,
          Timestamp: Date.now(),
        },
      };
      const result = await userCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    app.delete("/user/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/user/:id", async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;
      const filter = { _id: new ObjectId(id) };
      console.log(role, filter);
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch("/user/:email", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: {
            role: role,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.patch("/updateUser/:email", async (req, res) => {
      const email = req.params.email;
      const { name, photoUrl } = req.body;
      const filter = { email: email };
      const updateDoc = {
        $set: {
          name: name,
          photoUrl: photoUrl,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //categories

   

    app.get("/categories", async (req, res) => {
      const result = await categoryCollection.find().toArray();
      res.send(result);
    });

    //Medicines
    app.get("/medicines", async (req, res) => {
      const result = await medicineCollection.find().toArray();
      res.send(result);
    });

    app.post('/medicines',async (req,res)=>{
      const medicine = req.body;
      const result = await medicineCollection.insertOne(medicine)
      res.send(result)
    })


    app.delete("/medicine/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await medicineCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/medicines/seller", async (req, res) => {
      try {
          const email = req.query.email;
          if (!email) {
              return res.status(400).send({ error: "Email query parameter is required" });
          }
          const query = { email: email };
          const result = await medicineCollection.find(query).toArray();
          res.send(result);
      } catch (error) {
          console.error("Error fetching medicines:", error);
          res.status(500).send({ error: "An error occurred while fetching medicines" });
      }
  });



    app.get("/medicineByCategory", async (req, res) => {
      const categoryName = req.query.categoryName;
      const query = { categoryName: categoryName };
      const result = await medicineCollection.find(query).toArray();
      res.send(result);
    });

    //carts collection

    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    // Update cart item quantity
    app.put("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const updatedItem = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          quantity: updatedItem.quantity,
        },
      };
      const result = await cartCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Remove specific cart item
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    //  Clear all cart items for a specific user

    app.delete("/carts/", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.deleteMany(query);
      res.send(result);
    });


    //payment intent

    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      //  carefully delete each item from the cart
      console.log('payment info', payment);
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id) )
        }
      };

      const deleteResult = await cartCollection.deleteMany(query)
      res.send({paymentResult,deleteResult})
    })

    
    



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello medvantage!");
});

app.listen(port, () => {
  console.log(`Medvantage is running on port ${port}`);
});
