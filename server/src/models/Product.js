import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name : {type : String, required: true, trim: true},
    category : {type : String, required: true, trim: true},
    description : {type : String, required: true, trim: true},
    price : {type : Number, required: true, min: 0
    },
    deposit : {type : Number, required: true, min: 0},
    location : {type : String, required: true, trim: true},
    rating : {type : Number, min: 0, max: 5 ,default: 0},
    image : {type : String, trim: true},
    available : {type : Boolean,default: true}
},
    { timestamps: true }
)

export const Product = mongoose.model('Product',productSchema)