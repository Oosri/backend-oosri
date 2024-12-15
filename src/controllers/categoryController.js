// const Category = require('../models/categoryModel');

const predefinedCategories = [
  {
    name: 'Sculpture',
    description:
      'Figures, masks, and other objects carved from wood or other materials.'
  },
  {
    name: 'Textiles',
    description:
      'Woven fabrics, tapestries, and intricate patterns and designs (Adire, Tie and Die etc.).'
  },
  {
    name: 'Pottery',
    description: 'Functional and decorative ceramics used for various purposes.'
  },
  { name: 'Paintings', description: 'Modern and traditional paintings.' },
  { name: 'Cultural Basketry', description: 'Woven baskets.' },
  { name: 'Cultural Jewelry', description: 'Beads, necklaces, bracelets.' },
  { name: 'Woodworking', description: 'Carving and other wood-based crafts.' }
];

const getCategories = async (req, res) => {
  try {
    // const categories = await Category.find();
    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Categories fetched successfully',
      data: predefinedCategories
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = { getCategories };
