const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  blocks: [{
    type: String,
    color: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Block', blockSchema);