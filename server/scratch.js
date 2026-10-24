import { Product } from "./src/models/Product.js";

const product = new Product({
  name: "Chair",
  category: "Chair",
  description: "Chair",
  price: 500,
  deposit: 500,
  location: "Lucknow",
  rating: 0,
  available: true,
});

try {
  await product.validate();
  console.log("Valid", product);
} catch (err) {
  console.log(err.message);
}
