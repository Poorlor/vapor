const path = require('path');

// Tests and portable installations can use their own state directory.
const DATA_DIR = path.resolve(process.env.VAPOR_DATA_DIR || path.join(__dirname, '../data'));
module.exports = { DATA_DIR };
