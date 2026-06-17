const { createBratGifBuffer } = require("../src/server/bratApi");

module.exports = async (req, res) => {
  try {
    const text = typeof req.query.text === "string" ? req.query.text : "brat";
    const gifBuffer = await createBratGifBuffer(text, "bratvid");

    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Content-Disposition", 'inline; filename="bratvid.gif"');
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(gifBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate brat video" });
  }
};
