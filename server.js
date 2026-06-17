const path = require("path");
const express = require("express");
const { registerBratApi } = require("./src/server/bratApi");

const app = express();
const PORT = process.env.PORT || 3000;

registerBratApi(app);

app.use(express.static(path.join(__dirname, "dist")));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Failed to generate brat image" });
});

app.listen(PORT, () => {
  console.log(`Brat API server running on http://localhost:${PORT}`);
  console.log("GET /brat/?text=halo");
  console.log("GET /brathd/?text=halo");
});
