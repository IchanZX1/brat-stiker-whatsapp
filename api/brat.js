const { createBratJpgBuffer } = require("../src/server/bratApi");

module.exports = async (req, res) => {
  try {
    const text = typeof req.query.text === "string" ? req.query.text : "brat";
    const jpgBuffer = await createBratJpgBuffer(text, "brat");

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Disposition", 'inline; filename="brat.jpg"');
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(jpgBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate brat image" });
  }
};
