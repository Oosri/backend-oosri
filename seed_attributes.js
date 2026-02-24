const mongoose = require('mongoose');
const { Attribute } = require('./src/models/attributeModel');
const { Category } = require('./src/models/categoryModel');
require('dotenv').config();

const seedAttributes = async () => {
    try {
        const dbUrl = process.env.MONGO_URI || process.env.MONGO_URI_DEV;
        if (!dbUrl) {
            console.error('MONGO_URI or MONGO_URI_DEV not found in env');
            process.exit(1);
        }
        await mongoose.connect(dbUrl);
        console.log('Connected to DB');

        // 1. Define Attributes to Create
        const attributesToCreate = [
            // Shared
            { code: 'height', label: 'Height', type: 'number', isRequired: false },
            { code: 'width', label: 'Width', type: 'number', isRequired: false },
            { code: 'weight', label: 'Weight', type: 'number', isRequired: false },
            { code: 'length', label: 'Length', type: 'number', isRequired: false },
            { code: 'diameter', label: 'Diameter', type: 'number', isRequired: false },

            // Sculpture
            { code: 'technique', label: 'Technique', type: 'text', isRequired: false },

            // Textiles
            { code: 'yard', label: 'Yards', type: 'number', isRequired: false },
            { code: 'fabric_type', label: 'Fabric Type', type: 'text', isRequired: false }, // Map fabricType -> fabric_type
            { code: 'pattern', label: 'Pattern', type: 'text', isRequired: false },

            // Pottery
            { code: 'clay_type', label: 'Clay Type', type: 'text', isRequired: false }, // Map clayType -> clay_type
            { code: 'glaze', label: 'Glaze', type: 'text', isRequired: false },

            // Jewelry
            { code: 'stone_type', label: 'Stone Type', type: 'text', isRequired: false }, // Map stoneType -> stone_type
            { code: 'metal_type', label: 'Metal Type', type: 'text', isRequired: false }, // Map metalType -> metal_type

            // Paintings
            { code: 'medium', label: 'Medium', type: 'text', isRequired: false },
            { code: 'condition', label: 'Condition', type: 'select', options: ['New', 'Used', 'Antique'], isRequired: false },
            { code: 'size', label: 'Size', type: 'text', isRequired: false } // "Size" text field for paintings
        ];

        const attributeMap = {}; // code -> _id

        for (const attrData of attributesToCreate) {
            console.log(`Processing attribute: ${attrData.label}`);
            let attr = await Attribute.findOne({ code: attrData.code });
            if (!attr) {
                attr = new Attribute(attrData);
                await attr.save();
                console.log(`  - Created ${attr.code}`);
            } else {
                console.log(`  - Found existing ${attr.code}`);
                // Optionally update existing?
                // attr.set(attrData); await attr.save();
            }
            attributeMap[attrData.code] = attr._id;
        }

        // 2. Link Attributes to Categories
        const categoryMappings = [
            {
                name: 'Sculpture',
                attributes: ['height', 'width', 'weight', 'technique']
            },
            {
                name: 'Textiles/Fabrics',
                attributes: ['yard', 'fabric_type', 'pattern', 'weight'] // Frontend also has weight for textiles
            },
            {
                name: 'Pottery',
                attributes: ['height', 'diameter', 'clay_type', 'glaze']
            },
            {
                name: 'Jewelry',
                attributes: ['length', 'diameter', 'stone_type', 'metal_type']
            },
            {
                name: 'Paintings',
                attributes: ['medium', 'condition', 'size']
            }
        ];

        for (const mapping of categoryMappings) {
            console.log(`Linking attributes for category: ${mapping.name}`);
            let category = await Category.findOne({ name: mapping.name });

            if (!category) {
                console.log(`  - Category '${mapping.name}' not found. Creating it.`);
                category = new Category({
                    name: mapping.name,
                    description: `${mapping.name} category`,
                    image: 'https://via.placeholder.com/150',
                    attributes: []
                });
                await category.save();
            }

            const newAttributes = mapping.attributes.map(code => ({
                attributeId: attributeMap[code],
                isRequired: false, // Defaulting to false for flexibility, can be tuned
                isFilterable: true
            })).filter(a => a.attributeId); // Filter out if attr missing for some reason

            // Merge with existing attributes or replace?
            // Let's replace to ensure state matches plan, but keep unique ones if any.
            // Actually, simply setting it is safest for this "seed" operation which implies initialization.

            category.attributes = newAttributes;
            await category.save();
            console.log(`  - Updated ${category.name} with ${newAttributes.length} attributes.`);
        }

        console.log('Seeding complete.');
        process.exit(0);

    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
};

seedAttributes();
