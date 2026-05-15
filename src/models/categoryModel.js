const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const categorySchema = new Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  image: {
    type: String
  },
  attributes: [
    {
      attributeId: {
        type: Schema.Types.ObjectId,
        ref: 'Attribute'
      },
      isRequired: {
        type: Boolean,
        default: false
      },
      isFilterable: {
        type: Boolean,
        default: false
      }
    }
  ],
  requiresSubcategory: {
    type: Boolean,
    default: true
  }
});

const subCategorySchema = new Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  }
});

const Category = mongoose.model('Category', categorySchema);
const SubCategory = mongoose.model('SubCategory', subCategorySchema);

module.exports = { Category, SubCategory };
