const express = require("express");
const cors = require("cors");
var jwt = require("jsonwebtoken");
require("dotenv").config();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

//middelware

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://medvantage-mv.web.app",
    "https://medvantage-mv.firebaseapp.com",
  ],
};

app.use(cors(corsOptions));
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
    // await client.connect();

    const userCollection = client.db("medvantage").collection("users");
    const categoryCollection = client.db("medvantage").collection("categories");
    const medicineCollection = client.db("medvantage").collection("medicines");
    const cartCollection = client.db("medvantage").collection("carts");
    const sellerRequestCollection = client
      .db("medvantage")
      .collection("sellerRequests");

    const paymentCollection = client.db("medvantage").collection("payments");
    const advertisementCollection = client
      .db("medvantage")
      .collection("advertisements");

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
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);

      // If role is changed to user, delete the seller request entirely
      if (role === "user") {
        // Get the user's email to find their seller request
        const user = await userCollection.findOne(filter);
        if (user) {
          const sellerRequestFilter = { userEmail: user.email };
          await sellerRequestCollection.deleteOne(sellerRequestFilter);
        }
      }

      res.send(result);
    });

    app.patch("/user/:email", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const { role } = req.body;
      const filter = { email: email };
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);

      // If role is changed to user, delete the seller request entirely
      if (role === "user") {
        const sellerRequestFilter = { userEmail: email };
        await sellerRequestCollection.deleteOne(sellerRequestFilter);
      }

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

    app.post("/categories", async (req, res) => {
      const category = req.body;
      const result = await categoryCollection.insertOne(category);
      res.send(result);
    });

    app.patch("/categories/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const { categoryName, image } = req.body;

        const updateDoc = {
          $set: {
            categoryName,
            image,
          },
        };

        const result = await categoryCollection.updateOne(query, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating category:", error);
        res
          .status(500)
          .json({ error: "An error occurred while updating category" });
      }
    });

    app.delete("/categories/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await categoryCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error deleting category:", error);
        res
          .status(500)
          .json({ error: "An error occurred while deleting category" });
      }
    });

    //Medicines
    app.get("/medicines", async (req, res) => {
      const result = await medicineCollection.find().toArray();
      res.send(result);
    });

    app.get("/medicinesCount", async (req, res) => {
      const count = await medicineCollection.estimatedDocumentCount();
      res.send({ count });
    });

    app.post("/medicines", async (req, res) => {
      const medicine = req.body;
      const result = await medicineCollection.insertOne(medicine);
      res.send(result);
    });

    app.get("/medicine/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await medicineCollection.findOne(query);
      res.send(result);
    });

    app.patch("/medicine/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const {
          name,
          short_description,
          generic_name,
          image,
          company,
          mg,
          unit_price,
          discount,
          categoryName,
          sellerEmail,
        } = req.body;

        // Construct the query to find the medicine by its ID

        // Construct the update document
        const updateDoc = {
          $set: {
            name,
            short_description,
            generic_name,
            image,
            company,
            mg,
            unit_price,
            discount,
            categoryName,
            sellerEmail,
          },
        };

        // Update the medicine in the database
        const result = await medicineCollection.updateOne(query, updateDoc);

        res.send(result);
      } catch (error) {
        console.error("Error updating medicine:", error);
        res
          .status(500)
          .json({ error: "An error occurred while updating medicine" });
      }
    });

    app.delete("/medicine/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await medicineCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/medicines/seller", async (req, res) => {
      try {
        const sellerEmail = req.query.sellerEmail; // Corrected variable name
        if (!sellerEmail) {
          return res
            .status(400)
            .send({ error: "sellerEmail query parameter is required" }); // Corrected error message
        }
        const query = { sellerEmail: sellerEmail }; // Or simply { sellerEmail }, since the property name and variable name match
        const result = await medicineCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching medicines:", error);
        res
          .status(500)
          .send({ error: "An error occurred while fetching medicines" });
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
      const buyerEmail = req.query.buyerEmail;
      const query = { buyerEmail: buyerEmail };
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

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, "amount inside the intent");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.get("/payments", async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    app.patch("/payment/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body; // Extract status from request body
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: status, // Update status field with the extracted value
        },
      };
      try {
        const result = await paymentCollection.updateOne(query, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Error updating payment status:", error);
        res
          .status(500)
          .send({ error: "An error occurred while updating payment status" });
      }
    });

    app.post("/payments", verifyToken, async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      //  carefully delete each item from the cart
      console.log("payment info", payment);
      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };

      const deleteResult = await cartCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
    });

    app.get("/payments/:email", verifyToken, async (req, res) => {
      const query = { buyerEmail: req.params.email };
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/invoice/:transactionId", async (req, res) => {
      const id = req.params.transactionId;
      try {
        const result = await paymentCollection.findOne({ transactionId: id });
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send("Error fetching invoice");
      }
    });

    //advertisedment

    app.get("/advertisedment", async (req, res) => {
      const result = await advertisementCollection.find().toArray();
      res.send(result);
    });

    app.get("/advertisementBySeller", async (req, res) => {
      try {
        const email = req.query.email;

        const query = { email: email };
        const result = await advertisementCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching advertisement:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.post("/advertisementBySeller", async (req, res) => {
      const adItem = req.body;
      const result = await advertisementCollection.insertOne(adItem);
      res.send(result);
    });

    app.patch("/advertisement/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body; // Extract status from request body
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: status, // Update status field with the extracted value
        },
      };
      try {
        const result = await advertisementCollection.updateOne(
          query,
          updateDoc
        );
        res.send(result);
      } catch (error) {
        console.error("Error updating Ad status:", error);
        res
          .status(500)
          .send({ error: "An error occurred while updating ad status" });
      }
    });

    app.delete("/advertisement/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await advertisementCollection.deleteOne(query);
      res.send(result);
    });

    // Seller Request APIs
    app.post("/seller-requests", verifyToken, async (req, res) => {
      try {
        const requestData = req.body;
        const userEmail = req.decoded.email;

        // Check if user already has a pending request
        const existingRequest = await sellerRequestCollection.findOne({
          userEmail: userEmail,
          status: "pending",
        });

        if (existingRequest) {
          return res
            .status(400)
            .send({ message: "You already have a pending seller request" });
        }

        // Check if user is already a seller
        const user = await userCollection.findOne({ email: userEmail });
        if (user?.role === "seller") {
          return res.status(400).send({ message: "You are already a seller" });
        }

        const newRequest = {
          userEmail: userEmail,
          userName: requestData.userName,
          requestDate: new Date(),
          status: "pending",
          reason: requestData.reason || "",
          ...requestData,
        };

        const result = await sellerRequestCollection.insertOne(newRequest);
        res.send(result);
      } catch (error) {
        console.error("Error creating seller request:", error);
        res
          .status(500)
          .send({ error: "An error occurred while creating seller request" });
      }
    });

    app.get("/seller-requests", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await sellerRequestCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching seller requests:", error);
        res
          .status(500)
          .send({ error: "An error occurred while fetching seller requests" });
      }
    });

    app.patch(
      "/seller-requests/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.params.id;
          const { status } = req.body;
          const query = { _id: new ObjectId(id) };

          const updateDoc = {
            $set: {
              status: status,
              processedDate: new Date(),
            },
          };

          const result = await sellerRequestCollection.updateOne(
            query,
            updateDoc
          );

          // If approved, update user role to seller
          if (status === "approved") {
            const request = await sellerRequestCollection.findOne(query);
            if (request) {
              const userFilter = { email: request.userEmail };
              const userUpdateDoc = {
                $set: {
                  role: "seller",
                },
              };
              await userCollection.updateOne(userFilter, userUpdateDoc);
            }
          }

          res.send(result);
        } catch (error) {
          console.error("Error updating seller request:", error);
          res
            .status(500)
            .send({ error: "An error occurred while updating seller request" });
        }
      }
    );

    app.get("/seller-requests/user", verifyToken, async (req, res) => {
      try {
        const userEmail = req.decoded.email;
        const result = await sellerRequestCollection.findOne({
          userEmail: userEmail,
        });
        res.send(result);
      } catch (error) {
        console.error("Error fetching user seller request:", error);
        res
          .status(500)
          .send({ error: "An error occurred while fetching seller request" });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
