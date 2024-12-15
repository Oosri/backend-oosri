const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const categoryEnum = [
  'Sculpture',
  'Textiles',
  'Pottery',
  'Paintings',
  'Cultural Basketry',
  'Cultural Jewelry',
  'Woodworking'
];

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: categoryEnum
    },
    description: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = {
  Category: mongoose.model('Category', categorySchema),
  categoryEnum
};
