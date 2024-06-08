const express = require("express");
const cors = require("cors");
require('dotenv').config()



const app = express();
const port = process.env.PORT || 5000;

//middelware

app.use(cors());
app.use(express.json());


//mongodb


const { MongoClient, ServerApiVersion, Timestamp, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.omy4kgv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db('medvantage').collection('users')
    const categoryCollection = client.db('medvantage').collection('categories')
    const medicineCollection = client.db('medvantage').collection('medicines')
    const cartCollection = client.db('medvantage').collection('carts')


app.get('/users', async (req,res)=>{
    const result = await userCollection.find().toArray()
    res.send(result)
})
app.get('/user/:email', async (req,res)=>{
  const email = req.params.email
    const result = await userCollection.findOne({email})
    res.send(result)
})


app.put('/users', async(req,res)=>{
    const user = req.body;
    const query = {email: user?.email}
    //check if the already exist in the database
    const isExist = await userCollection.findOne(query)
    if(isExist) {
        return res.send({message: 'User aleready exist'})
    }
    const options = {upsert: true}
    const updateDoc = {
        $set: {
            ...user,
            Timestamp: Date.now(),
        }
    }
    const result = await userCollection.updateOne(query,updateDoc,options)
    res.send(result)
})

app.delete('/user/:id',async(req,res)=>{
  const id = req.params.id;
  const query = {_id: new ObjectId(id)}
  const result = await userCollection.deleteOne(query)
  res.send(result)
})

app.patch('/user/:id',async(req,res)=>{
  const id = req.params.id;
  const {role }= req.body;
  const filter = {_id: new ObjectId(id)}
  console.log(role,filter)
  const updateDoc = {
    $set: {
      role: role
    },
  };
  const result = await userCollection.updateOne(filter,updateDoc)
  res.send(result)
})

app.patch('/user/:email',async(req,res)=>{
  const email = req.params.email;
  const filter = {email: email}
  const updateDoc = {
    $set: {
      role: role
    },
  };
  const result = await userCollection.updateOne(filter,updateDoc)
  res.send(result)
})
app.patch('/updateUser/:email',async(req,res)=>{
  const email = req.params.email;
  const { name, photoUrl } = req.body;
  const filter = {email: email}
  const updateDoc = {
    $set: {
      name: name,
      photoUrl:photoUrl
      
    },
  };
  const result = await userCollection.updateOne(filter,updateDoc)
  res.send(result)
})

app.get('/categories',async(req,res)=>{
  
  const result = await categoryCollection.find().toArray()
  res.send(result)
})
app.get('/medicines',async(req,res)=>{
  
  const result = await medicineCollection.find().toArray()
  res.send(result)
})

app.get("/medicineByCategory", async (req, res) => {
  const categoryName = req.query.categoryName;
  const query = { categoryName: categoryName };
  const result = await medicineCollection.find(query).toArray();
  res.send(result);
});

//carts collection 

app.post('/carts',async(req,res)=>{
  const cartItem = req.body;
  const result = await cartCollection.insertOne(cartItem)
  res.send(result)
})


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
      quantity: updatedItem.quantity
    }
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

// // Clear all cart items for a specific user
// app.delete("/carts/clear", async (req, res) => {
//   const email = req.query.email;
//   const query = { email: email };
//   const result = await cartCollection.deleteMany(query);
//   res.send(result);
// });


app.delete("/carts/", async (req, res) => {
  const email = req.query.email;
  const query = { email: email };
  const result = await cartCollection.deleteMany(query);
  res.send(result);
});



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
