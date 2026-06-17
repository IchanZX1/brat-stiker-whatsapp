const { API_TYPES } = require("../src/server/bratApi");

module.exports = (req, res) => {
  res.status(200).json({
    endpoints: {
      brat: "/brat/?text=your%20text",
      brathd: "/brathd/?text=your%20text",
      bratvid: "/bratvid/?text=your%20text",
    },
    config: {
      brat: {
        fontSize: `${API_TYPES.brat.fontSize}px`,
        friedLevel: `${API_TYPES.brat.friedLevel}%`,
      },
      brathd: {
        fontSize: `${API_TYPES.brathd.fontSize}px`,
        friedLevel: `${API_TYPES.brathd.friedLevel}%`,
      },
      bratvid: {
        fontSize: `${API_TYPES.bratvid.fontSize}px`,
        friedLevel: `${API_TYPES.bratvid.friedLevel}%`,
      },
    },
  });
};