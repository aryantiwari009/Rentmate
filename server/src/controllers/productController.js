import mongoose from "mongoose";
import { Product } from "../models/Product.js";

export async function getProducts( req, res ) {
    const products = await Product.find();
    res.json(products);
}

export async function getProductsById( req, res ) {
    if(!mongoose.isValidObjectId(req.params.id)){
        return res.status(400).json({ message : "Invalid ID format" })
    }
    const product = await Product.findById(req.params.id);
    if(!product){
        return res.status(404).json({ message : "Product not found" });
    }else{
        return res.status(200).json({ product });
    }
}