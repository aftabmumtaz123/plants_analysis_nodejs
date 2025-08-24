require("dotenv").config()

const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const streamifier = require("streamifier");
const mongodb =require("mongoose")
const app = express();
const port = 3000;




mongodb.connect("mongodb://localhost:27017/image_upload_multer").then(()=>{
  console.log("Database is connected successfully");
}).catch((e)=>{
  console.log("There's error while connecting to the database "+ e);
})


const imageSchema = new mongodb.Schema({
  url: String,
  public_id: String
})

const Image = mongodb.model("Image", imageSchema)






// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});

// Storage engine for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "images-folder",   // Folder in Cloudinary
    format: async (req, file) => "png", // convert to png
    public_id: (req, file) => "file_" + Date.now()
  }
});

const upload = multer({ storage: storage });

app.post("/upload", upload.single("file"), async (req, res) => {

  const uploaded = await Image.create({
    url: req.file.path,
    public_id: req.file.filename
  })
  res.json({msg: "File Uploaded", uploaded})
});




app.get("/images",async (req,res)=>{
  try {
    const images = await Image.find();
    res.json({images})
  } catch (error) {
    res.json({error})
  }
})





app.listen(port, () => {
  console.log(`App running on http://localhost:${port}`);
});
